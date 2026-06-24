import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import * as L from 'leaflet';
import { Courier, MapBounds } from '../../services/dispatch/types';

@Component({
  selector: 'app-dispatch-map',
  standalone: true,
  template: `<div #mapHost class="map-host" role="application" aria-label="Mapa de entregadores POA Centro"></div>`,
  styles: [
    `
      .map-host {
        width: 100%;
        height: 100%;
        min-height: 400px;
      }
    `,
  ],
})
export class DispatchMapComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  @Input() bounds: MapBounds | null = null;
  @Input() couriers: Courier[] = [];
  @Input() selectedId: string | null = null;

  private map?: L.Map;
  private markers = new Map<string, L.CircleMarker>();
  private routeLine?: L.Polyline;

  ngAfterViewInit(): void {
    this.initMap();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.map && (changes['couriers'] || changes['selectedId'] || changes['bounds'])) {
      this.render();
    }
  }

  private initMap(): void {
    const center = this.bounds
      ? [this.bounds.center_lat, this.bounds.center_lng] as L.LatLngExpression
      : ([-30.0277, -51.2284] as L.LatLngExpression);

    this.map = L.map(this.mapHost.nativeElement, {
      center,
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    if (this.bounds) {
      L.rectangle(
        [
          [this.bounds.min_lat, this.bounds.min_lng],
          [this.bounds.max_lat, this.bounds.max_lng],
        ],
        { color: '#2563eb', weight: 1, fillOpacity: 0.03, dashArray: '4 4' },
      ).addTo(this.map);
    }
  }

  private render(): void {
    if (!this.map) return;

    const seen = new Set<string>();
    for (const courier of this.couriers) {
      seen.add(courier.id);
      const color = this.markerColor(courier.tracking_state);
      const latlng: L.LatLngExpression = [courier.position.lat, courier.position.lng];
      let marker = this.markers.get(courier.id);
      if (!marker) {
        marker = L.circleMarker(latlng, {
          radius: courier.id === this.selectedId ? 10 : 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        }).addTo(this.map);
        marker.bindTooltip(`${courier.id} · ${courier.name}`, { direction: 'top' });
        this.markers.set(courier.id, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setStyle({
          radius: courier.id === this.selectedId ? 10 : 7,
          fillColor: color,
        });
      }
    }

    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = undefined;
    }

    const selected = this.couriers.find((c) => c.id === this.selectedId);
    if (selected && selected.route.length > 1) {
      const pts = selected.route.map((p) => [p.lat, p.lng] as L.LatLngExpression);
      this.routeLine = L.polyline(pts, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(
        this.map,
      );
    }
  }

  private markerColor(state: Courier['tracking_state']): string {
    switch (state) {
      case 'live':
        return '#22c55e';
      case 'stale':
        return '#f59e0b';
      default:
        return '#94a3b8';
    }
  }
}
