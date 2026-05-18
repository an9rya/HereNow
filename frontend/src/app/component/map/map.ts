import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';

type PersonLocation = {
  name: string;
  lat: number;
  lng: number;
  neighborhood: string;
  group: string;
};

type PersonMovement = {
  person: PersonLocation;
  targetLat: number;
  targetLng: number;
  startLat: number;
  startLng: number;
  progress: number;
  isMoving: boolean;
  nextMoveTime: number;
  currentDirection?: number; // Angle in radians for directional movement
  currentSpeed: number; // Speed in km/h
  targetSpeed: number; // Target speed for this movement segment (0-120 km/h)
  animationDuration: number; // Dynamic animation duration based on speed
  isInDowntown?: boolean; // Track whether person is currently inside downtown geofence
};

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class Map implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer?: ElementRef<HTMLDivElement>;

  protected readonly groups: string[] = ['Group A', 'Group B', 'Group C'];
  protected readonly people: PersonLocation[];

  private map?: L.Map;
  private previousMarker?: L.Marker;
  private markerMap: { [key: string]: L.Marker } = {};
  protected selectedPerson = signal<PersonLocation | null>(null);
  protected selectedGroups = signal<Set<string>>(new Set(this.groups));
  protected readonly peopleOutside = signal<PersonLocation[]>([]);
  private animationFrameId?: number;
  private personMovements: { [key: string]: PersonMovement } = {};
  private lastMarkerInteractionAt = 0;
  private readonly MAP_UNFOCUS_GUARD_MS = 300;
  private readonly MOVEMENT_RADIUS = 0.008; // Radius in degrees (~800 meters at equator)
  private readonly BASE_MOVE_INTERVAL = 2500; // Base interval between movements in ms
  private readonly MIN_SPEED = 0; // Minimum speed in km/h
  private readonly MAX_SPEED = 120; // Maximum speed in km/h
  private readonly SPEED_MULTIPLIER = 1.35; // Global multiplier to make movement feel snappier
  // Expand bounds to cover the Greater Toronto Area (GTA)
  private readonly TORONTO_BOUNDS = {
    north: 43.90,
    south: 43.35,
    east: -79.10,
    west: -80.00,
  };

  // Geofence: circular area centered on Downtown Toronto up to Pearson Airport
  private readonly geofenceCenter = { lat: 43.6532, lng: -79.3832 }; // Downtown centre
  // Toronto Pearson Airport approximate coordinates
  private readonly geofenceAirport = { lat: 43.6777, lng: -79.6248 };
  private geofenceRadiusMeters = 0; // computed in constructor

  constructor() {
    // compute circular geofence radius from downtown to airport
    this.geofenceRadiusMeters = this.calculateDistance(
      this.geofenceCenter.lat,
      this.geofenceCenter.lng,
      this.geofenceAirport.lat,
      this.geofenceAirport.lng
    );
    // Move some people to nearby cities around Toronto (GTA)
    this.people = this.createPeopleWithRandomGroups([
      { name: 'Ava', lat: 43.6532, lng: -79.3832, neighborhood: 'Downtown Toronto' },
      { name: 'Noah', lat: 43.5934, lng: -79.6406, neighborhood: 'Mississauga' },
      { name: 'Mia', lat: 43.6614, lng: -79.3915, neighborhood: 'University District' },
      { name: 'Liam', lat: 43.7315, lng: -79.7624, neighborhood: 'Brampton' },
      { name: 'Sophia', lat: 43.8561, lng: -79.3370, neighborhood: 'Markham' },
      { name: 'Ethan', lat: 43.6681, lng: -79.4071, neighborhood: 'The Annex' },
      { name: 'Olivia', lat: 43.6414, lng: -79.3895, neighborhood: 'Harbourfront' },
      { name: 'Lucas', lat: 43.8372, lng: -79.5083, neighborhood: 'Vaughan' },
      { name: 'Amelia', lat: 43.4675, lng: -79.6877, neighborhood: 'Oakville' },
      { name: 'Benjamin', lat: 43.6752, lng: -79.2473, neighborhood: 'Scarborough' },
    ]);
  }

  ngAfterViewInit(): void {
    if (!this.mapContainer) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([43.6532, -79.3832], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    const bounds = L.latLngBounds([]);

    this.people.forEach((person, index) => {
      const personIcon = this.createPersonIcon(person.name, 0);
      const marker = L.marker([person.lat, person.lng], { icon: personIcon }).addTo(this.map!);
      this.markerMap[person.name] = marker;
      marker
        .bindTooltip(`<strong>${person.name}</strong><br />Speed: 0.0 km/h`, {
          direction: 'top',
          offset: [0, -8],
        })
        .on('click', (event: L.LeafletEvent) => this.onMarkerInteraction(person, event))
        .on('touchstart', (event: L.LeafletEvent) => this.onMarkerInteraction(person, event))
        .on('mousedown', (event: L.LeafletEvent) => this.onMarkerInteraction(person, event));
      bounds.extend([person.lat, person.lng]);

      // Initialize movement tracking for this person
      this.personMovements[person.name] = {
        person,
        targetLat: person.lat,
        targetLng: person.lng,
        startLat: person.lat,
        startLng: person.lng,
        progress: 1,
        isMoving: false,
        nextMoveTime: Date.now() + Math.random() * this.BASE_MOVE_INTERVAL,
        currentSpeed: 0,
        targetSpeed: 0,
        animationDuration: 3000,
        isInDowntown: this.isInDowntown(person.lat, person.lng),
      };
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
    }

    // Initialize peopleOutside list based on initial downtown membership
    const outside = Object.values(this.personMovements)
      .filter(m => !m.isInDowntown)
      .map(m => m.person);
    this.peopleOutside.set(outside);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      if (Date.now() - this.lastMarkerInteractionAt < this.MAP_UNFOCUS_GUARD_MS) {
        return;
      }
      if (this.shouldIgnoreMapClick(event)) {
        return;
      }
      this.clearFocus();
    });

    this.applyGroupFilter();

    // Start the smooth animation loop
    this.startSmoothAnimation();
  }

  protected toggleGroup(group: string): void {
    const next = new Set(this.selectedGroups());
    if (next.has(group)) {
      next.delete(group);
    } else {
      next.add(group);
    }
    this.selectedGroups.set(next);
    this.applyGroupFilter();
  }

  protected isGroupSelected(group: string): boolean {
    return this.selectedGroups().has(group);
  }

  protected isPersonVisible(person: PersonLocation): boolean {
    return this.isGroupSelected(person.group);
  }

  private applyGroupFilter(): void {
    if (!this.map) {
      return;
    }

    for (const person of this.people) {
      const marker = this.markerMap[person.name];
      if (!marker) {
        continue;
      }

      if (this.isPersonVisible(person)) {
        if (!this.map.hasLayer(marker)) {
          marker.addTo(this.map);
        }
      } else if (this.map.hasLayer(marker)) {
        marker.closeTooltip();
        this.map.removeLayer(marker);
      }
    }

    const selected = this.selectedPerson();
    if (selected && !this.isPersonVisible(selected)) {
      if (this.previousMarker) {
        this.previousMarker.closeTooltip();
      }
      this.selectedPerson.set(null);
      this.previousMarker = undefined;
    }
  }

  private createPeopleWithRandomGroups(
    people: Array<Omit<PersonLocation, 'group'>>
  ): PersonLocation[] {
    return people.map(person => {
      const randomGroup = this.groups[Math.floor(Math.random() * this.groups.length)];
      return {
        ...person,
        group: randomGroup,
      };
    });
  }

  private easeInOutQuad(t: number): number {
    // Easing function for smooth movement
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  private isWithinBounds(lat: number, lng: number): boolean {
    return (
      lat >= this.TORONTO_BOUNDS.south &&
      lat <= this.TORONTO_BOUNDS.north &&
      lng >= this.TORONTO_BOUNDS.west &&
      lng <= this.TORONTO_BOUNDS.east
    );
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private isInWater(lat: number, lng: number): boolean {
    // Approximate Lake Ontario / harbour water and avoid placing people there.
    // This is intentionally conservative: if a point looks like it is over the lake,
    // we reject it and generate another one.
    const lakeOntario = lat < 43.72 && lng > -79.60 && lng < -79.12;
    const torontoHarbour = lat < 43.66 && lng > -79.40 && lng < -79.34;
    const mississaugaShore = lat < 43.58 && lng > -79.68 && lng < -79.45;
    return lakeOntario || torontoHarbour || mississaugaShore;
  }

  private isInDowntown(lat: number, lng: number): boolean {
    const d = this.calculateDistance(lat, lng, this.geofenceCenter.lat, this.geofenceCenter.lng);
    return d <= this.geofenceRadiusMeters;
  }

  private triggerGeofenceAlert(person: PersonLocation): void {
    // Alerts removed: log for debugging only
    console.info(`${person.name} left the Toronto geofence.`);
  }

  protected isPersonShownInMainList(person: PersonLocation): boolean {
    // Person must be visible by group and not currently outside downtown
    const outside = this.peopleOutside().some(p => p.name === person.name);
    return this.isPersonVisible(person) && !outside;
  }

  private createPersonIcon(personName: string, speed: number, isSelected: boolean = false): L.DivIcon {
    const initial = personName.charAt(0).toUpperCase();
    const color = isSelected ? '#dc2626' : '#2563eb';
    const darkColor = isSelected ? '#b91c1c' : '#1e40af';
    const speedText = speed > 0 ? `<tspan x="12" dy="1.2em" font-size="6" fill="#000" text-anchor="middle">${Math.round(speed)}</tspan>` : '';
    
    return L.divIcon({
      className: isSelected ? 'person-marker-red' : 'person-marker',
      html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width="32" height="42" style="pointer-events:none"><path d="M12 0C6.48 0 2 4.48 2 10c0 7 10 22 10 22s10-15 10-22c0-5.52-4.48-10-10-10z" fill="${color}" stroke="${darkColor}" stroke-width="0.5"/><circle cx="12" cy="10" r="5" fill="#ffffff" stroke="#d1d5db" stroke-width="0.5"/><text x="12" y="11" font-size="8" font-weight="bold" fill="#1f2937" text-anchor="middle" dy="0.3em">${initial}</text>${speedText}</svg>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });
  }

  private generateTargetLocation(currentLat: number, currentLng: number): { lat: number; lng: number } {
    // Choose a nearby random point within the Toronto/GTA bounds, avoiding water.
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 0.01 + Math.random() * 0.04;
      const lat = currentLat + Math.cos(angle) * distance;
      const lng = currentLng + Math.sin(angle) * distance;

      if (this.isWithinBounds(lat, lng) && !this.isInWater(lat, lng)) {
        return { lat, lng };
      }
    }

    // Fallback: if we fail to find a land point, stay put rather than jumping into water.
    return { lat: currentLat, lng: currentLng };
  }

  private startSmoothAnimation(): void {
    const animate = () => {
      const now = Date.now();

      Object.values(this.personMovements).forEach((movement: PersonMovement) => {
        // Check if it's time to start a new movement
        if (!movement.isMoving && now >= movement.nextMoveTime) {
          movement.startLat = movement.person.lat;
          movement.startLng = movement.person.lng;
          const target = this.generateTargetLocation(movement.person.lat, movement.person.lng);
          movement.targetLat = target.lat;
          movement.targetLng = target.lng;
          
          // Generate random speed for this movement (0-120 km/h)
          movement.targetSpeed = Math.random() * this.MAX_SPEED;
          
          // Calculate animation duration based on distance and speed
          const distanceMeters = this.calculateDistance(
            movement.startLat,
            movement.startLng,
            movement.targetLat,
            movement.targetLng
          );
          
          if (movement.targetSpeed > 0.5) {
            const speedMs = (movement.targetSpeed / 3.6); // Convert km/h to m/s
            movement.animationDuration = ((distanceMeters / speedMs) * 1000) / this.SPEED_MULTIPLIER; // Duration in ms
          } else {
            movement.animationDuration = 3000; // Default duration if speed is 0
            movement.targetSpeed = 0;
          }
          
          movement.progress = 0;
          movement.isMoving = true;
        }

        // Animate the movement
        if (movement.isMoving) {
          movement.progress += 16 / movement.animationDuration; // ~60fps

          if (movement.progress >= 1) {
            movement.progress = 1;
            movement.isMoving = false;
            movement.currentSpeed = 0;
            movement.nextMoveTime = now + this.BASE_MOVE_INTERVAL + Math.random() * this.BASE_MOVE_INTERVAL;
          }

          // Apply easing function
          const easedProgress = this.easeInOutQuad(movement.progress);

          // Interpolate position
          const newLat =
            movement.startLat + (movement.targetLat - movement.startLat) * easedProgress;
          const newLng =
            movement.startLng + (movement.targetLng - movement.startLng) * easedProgress;

          movement.person.lat = newLat;
          movement.person.lng = newLng;

          // Current speed is the target speed during movement
          movement.currentSpeed = movement.isMoving ? movement.targetSpeed : 0;

          // Update marker with new icon showing speed and initial
          const marker = this.markerMap[movement.person.name];
          if (marker) {
            const isSelected = this.selectedPerson()?.name === movement.person.name;
            const newIcon = this.createPersonIcon(
              movement.person.name,
              movement.currentSpeed,
              isSelected
            );
            marker.setIcon(newIcon);
            marker.setLatLng([newLat, newLng]);
            marker.setTooltipContent(
              `<strong>${movement.person.name}</strong><br />Speed: ${movement.currentSpeed.toFixed(1)} km/h`
            );
            if (isSelected) {
              marker.openTooltip();
            }
          }

          // Geofence check: detect exit from downtown
          const wasInDowntown = movement.isInDowntown ?? false;
          const nowInDowntown = this.isInDowntown(newLat, newLng);
          if (wasInDowntown && !nowInDowntown) {
            movement.isInDowntown = false;
            this.triggerGeofenceAlert(movement.person);
            // Add to outside list if not already present
            const current = this.peopleOutside();
            if (!current.find(p => p.name === movement.person.name)) {
              this.peopleOutside.set([...current, movement.person]);
            }
          } else if (!wasInDowntown && nowInDowntown) {
            // Person re-entered downtown: remove from outside list
            movement.isInDowntown = true;
            const current = this.peopleOutside();
            this.peopleOutside.set(current.filter(p => p.name !== movement.person.name));
          } else {
            movement.isInDowntown = nowInDowntown;
          }
        } else if (!movement.isMoving) {
          // Update popup when stopped to remove speed
          const marker = this.markerMap[movement.person.name];
          if (marker) {
            const isSelected = this.selectedPerson()?.name === movement.person.name;
            const stoppedIcon = this.createPersonIcon(movement.person.name, 0, isSelected);
            marker.setIcon(stoppedIcon);
            marker.setTooltipContent(
              `<strong>${movement.person.name}</strong><br />Speed: 0.0 km/h`
            );
            if (isSelected) {
              marker.openTooltip();
            }
          }
        }
      });

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  focusPerson(person: PersonLocation): void {
    if (!this.map) return;
    if (!this.isPersonVisible(person)) return;

    // Revert previous marker to blue
    if (this.previousMarker) {
      // Get the person name from the marker
      const prevPersonName = Object.keys(this.markerMap).find(name => this.markerMap[name] === this.previousMarker);
      if (prevPersonName) {
        const movement = this.personMovements[prevPersonName];
        const speed = movement?.currentSpeed || 0;
        const blueIcon = this.createPersonIcon(prevPersonName, speed, false);
        this.previousMarker.setIcon(blueIcon);
        this.previousMarker.closeTooltip();
      }
    }

    // Set selected marker to red
    const selectedMarker = this.markerMap[person.name];
    if (selectedMarker) {
      const movement = this.personMovements[person.name];
      const speed = movement?.currentSpeed || 0;
      const redIcon = this.createPersonIcon(person.name, speed, true);
      selectedMarker.setIcon(redIcon);
      selectedMarker.openTooltip();
      this.previousMarker = selectedMarker;
    }

    this.selectedPerson.set(person);
    this.map.flyTo([person.lat, person.lng], 15);
  }

  private onMarkerInteraction(person: PersonLocation, event: L.LeafletEvent): void {
    this.lastMarkerInteractionAt = Date.now();
    const originalEvent = (event as L.LeafletMouseEvent).originalEvent;
    if (originalEvent) {
      originalEvent.stopPropagation();
    }
    this.focusPerson(person);
  }

  private clearFocus(): void {
    if (!this.previousMarker) {
      this.selectedPerson.set(null);
      return;
    }

    const prevPersonName = Object.keys(this.markerMap).find(
      name => this.markerMap[name] === this.previousMarker
    );

    if (prevPersonName) {
      const movement = this.personMovements[prevPersonName];
      const speed = movement?.currentSpeed || 0;
      const blueIcon = this.createPersonIcon(prevPersonName, speed, false);
      this.previousMarker.setIcon(blueIcon);
      this.previousMarker.closeTooltip();
    }

    this.previousMarker = undefined;
    this.selectedPerson.set(null);
  }

  private shouldIgnoreMapClick(event: L.LeafletMouseEvent): boolean {
    const target = event.originalEvent?.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest('.leaflet-marker-icon') ||
        target.closest('.leaflet-tooltip') ||
        target.closest('.leaflet-popup')
    );
  }

  ngOnDestroy(): void {
    // Cancel the animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.map?.remove();
  }
}
