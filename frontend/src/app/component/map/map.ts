import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';

type PersonLocation = {
  name: string;
  lat: number;
  lng: number;
  neighborhood: string;
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

    const personIcon = L.divIcon({
      className: 'person-marker',
      html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width="32" height="42"><path d="M12 0C6.48 0 2 4.48 2 10c0 7 10 22 10 22s10-15 10-22c0-5.52-4.48-10-10-10z" fill="#2563eb" stroke="#1e40af" stroke-width="0.5"/><circle cx="12" cy="10" r="4" fill="#fff" opacity="0.9"/></svg>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    const redPersonIcon = L.divIcon({
      className: 'person-marker-red',
      html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width="32" height="42"><path d="M12 0C6.48 0 2 4.48 2 10c0 7 10 22 10 22s10-15 10-22c0-5.52-4.48-10-10-10z" fill="#dc2626" stroke="#b91c1c" stroke-width="0.5"/><circle cx="12" cy="10" r="4" fill="#fff" opacity="0.9"/></svg>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    const bounds = L.latLngBounds([]);

    this.people.forEach((person) => {
      const marker = L.marker([person.lat, person.lng], { icon: personIcon }).addTo(this.map!);
      this.markerMap[person.name] = marker;
      marker
        .bindPopup(`<strong>${person.name}</strong><br />${person.neighborhood}, Toronto`)
        .bindTooltip(person.name, { direction: 'top', offset: [0, -8] })
        .on('click', () => this.focusPerson(person));
      bounds.extend([person.lat, person.lng]);
    });

    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
    }
  }

  focusPerson(person: PersonLocation): void {
    if (!this.map) return;

    // Revert previous marker to blue
    if (this.previousMarker) {
      const blueIcon = L.divIcon({
        className: 'person-marker',
        html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width="32" height="42"><path d="M12 0C6.48 0 2 4.48 2 10c0 7 10 22 10 22s10-15 10-22c0-5.52-4.48-10-10-10z" fill="#2563eb" stroke="#1e40af" stroke-width="0.5"/><circle cx="12" cy="10" r="4" fill="#fff" opacity="0.9"/></svg>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42],
      });
      this.previousMarker.setIcon(blueIcon);
    }

    // Set selected marker to red
    const selectedMarker = this.markerMap[person.name];
    if (selectedMarker) {
      const redIcon = L.divIcon({
        className: 'person-marker-red',
        html: `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" width="32" height="42"><path d="M12 0C6.48 0 2 4.48 2 10c0 7 10 22 10 22s10-15 10-22c0-5.52-4.48-10-10-10z" fill="#dc2626" stroke="#b91c1c" stroke-width="0.5"/><circle cx="12" cy="10" r="4" fill="#fff" opacity="0.9"/></svg>`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -42],
      });
      selectedMarker.setIcon(redIcon);
      this.previousMarker = selectedMarker;
    }

    this.selectedPerson.set(person);
    this.map.flyTo([person.lat, person.lng], 15);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
