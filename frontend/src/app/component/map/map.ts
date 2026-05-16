import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';

type PersonLocation = {
  name: string;
  lat: number;
  lng: number;
  neighborhood: string;
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
};

@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class Map implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer?: ElementRef<HTMLDivElement>;

  protected readonly people: PersonLocation[] = [
    { name: 'Ava', lat: 43.6532, lng: -79.3832, neighborhood: 'Downtown' },
    { name: 'Noah', lat: 43.6465, lng: -79.3806, neighborhood: 'Entertainment District' },
    { name: 'Mia', lat: 43.6614, lng: -79.3915, neighborhood: 'University District' },
    { name: 'Liam', lat: 43.6487, lng: -79.3767, neighborhood: 'St. Lawrence' },
    { name: 'Sophia', lat: 43.6703, lng: -79.3793, neighborhood: 'Yorkville' },
    { name: 'Ethan', lat: 43.6681, lng: -79.4071, neighborhood: 'The Annex' },
    { name: 'Olivia', lat: 43.6414, lng: -79.3895, neighborhood: 'Harbourfront' },
    { name: 'Lucas', lat: 43.6515, lng: -79.3627, neighborhood: 'Distillery District' },
    { name: 'Amelia', lat: 43.6757, lng: -79.4093, neighborhood: 'Casa Loma' },
    { name: 'Benjamin', lat: 43.6293, lng: -79.3936, neighborhood: 'Fort York' },
  ];

  private map?: L.Map;
  private previousMarker?: L.Marker;
  private markerMap: { [key: string]: L.Marker } = {};
  protected selectedPerson = signal<PersonLocation | null>(null);
  private animationFrameId?: number;
  private personMovements: { [key: string]: PersonMovement } = {};
  private readonly MOVEMENT_RADIUS = 0.008; // Radius in degrees (~800 meters at equator)
  private readonly BASE_MOVE_INTERVAL = 2500; // Base interval between movements in ms
  private readonly MIN_SPEED = 0; // Minimum speed in km/h
  private readonly MAX_SPEED = 120; // Maximum speed in km/h
  private readonly SPEED_MULTIPLIER = 1.35; // Global multiplier to make movement feel snappier
  private readonly TORONTO_BOUNDS = {
    north: 43.72,
    south: 43.58,
    east: -79.34,
    west: -79.43,
  };

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
        .on('click', () => this.focusPerson(person))
        .on('touchstart', () => this.focusPerson(person))
        .on('mousedown', () => this.focusPerson(person));
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
      };
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
    }

    // Start the smooth animation loop
    this.startSmoothAnimation();
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
    let targetLat: number;
    let targetLng: number;
    let attempts = 0;

    do {
      const angle = Math.random() * Math.PI * 2; // Random direction 0-2π
      const distance = Math.random() * this.MOVEMENT_RADIUS;

      targetLat = currentLat + Math.cos(angle) * distance;
      targetLng = currentLng + Math.sin(angle) * distance;
      attempts++;
    } while (!this.isWithinBounds(targetLat, targetLng) && attempts < 5);

    if (!this.isWithinBounds(targetLat, targetLng)) {
      return { lat: currentLat, lng: currentLng };
    }

    return { lat: targetLat, lng: targetLng };
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

  ngOnDestroy(): void {
    // Cancel the animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.map?.remove();
  }
}
