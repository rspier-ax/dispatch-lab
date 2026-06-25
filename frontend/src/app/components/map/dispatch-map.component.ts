import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import * as L from 'leaflet';
import { Courier, Landmark, MapBounds, TrackingState } from '../../services/dispatch/types';
import {
  courierMatchesFilter,
  markerClass,
  routePointsToLatLngs,
  trackingStateShortLabel,
  TrackingFilter,
} from '../../lib/dispatch-view.utils';

interface MarkerEntry {
  marker: L.Marker;
  lastState: TrackingState;
}

@Component({
  selector: 'app-dispatch-map',
  standalone: true,
  templateUrl: './dispatch-map.component.html',
  styleUrl: './dispatch-map.component.scss',
})
export class DispatchMapComponent implements AfterViewInit, OnChanges {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  @Input() bounds: MapBounds | null = null;
  @Input() couriers: Courier[] = [];
  @Input() landmarks: Landmark[] = [];
  @Input() selectedId: string | null = null;
  @Input() filter: TrackingFilter = 'all';
  @Output() filterChange = new EventEmitter<TrackingFilter>();
  @Output() selectCourier = new EventEmitter<string>();

  readonly filterOptions: { value: TrackingFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'live', label: 'Ao vivo' },
    { value: 'stale', label: 'Atrasado' },
    { value: 'offline', label: 'Sem sinal' },
  ];

  private map?: L.Map;
  private markers = new Map<string, MarkerEntry>();
  private landmarkMarkers: L.Marker[] = [];
  private routeBg?: L.Polyline;
  private routeFg?: L.Polyline;
  private boundsRect?: L.Rectangle;
  private stalePulseIds = new Set<string>();

  ngAfterViewInit(): void {
    this.initMap();
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['couriers']) {
      this.trackStaleTransitions();
    }
    if (
      changes['couriers'] ||
      changes['selectedId'] ||
      changes['bounds'] ||
      changes['landmarks'] ||
      changes['filter']
    ) {
      this.render();
    }
  }

  onFilterClick(value: TrackingFilter): void {
    this.filterChange.emit(value);
  }

  fitOperationArea(): void {
    if (!this.map || !this.bounds) return;
    this.map.fitBounds(
      [
        [this.bounds.min_lat, this.bounds.min_lng],
        [this.bounds.max_lat, this.bounds.max_lng],
      ],
      { padding: [24, 24] },
    );
  }

  private initMap(): void {
    const center = this.bounds
      ? ([this.bounds.center_lat, this.bounds.center_lng] as L.LatLngExpression)
      : ([-30.0277, -51.2284] as L.LatLngExpression);

    this.map = L.map(this.mapHost.nativeElement, {
      center,
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

    if (this.bounds) {
      this.boundsRect = L.rectangle(
        [
          [this.bounds.min_lat, this.bounds.min_lng],
          [this.bounds.max_lat, this.bounds.max_lng],
        ],
        { color: '#1672e8', weight: 1, fillOpacity: 0.03, dashArray: '4 4' },
      ).addTo(this.map);
    }
  }

  private trackStaleTransitions(): void {
    for (const courier of this.couriers) {
      const entry = this.markers.get(courier.id);
      if (entry && entry.lastState !== 'stale' && courier.tracking_state === 'stale') {
        this.stalePulseIds.add(courier.id);
      }
    }
  }

  private render(): void {
    if (!this.map) return;

    const visible = this.couriers.filter((c) => courierMatchesFilter(c.tracking_state, this.filter));
    const seen = new Set<string>();

    for (const courier of visible) {
      seen.add(courier.id);
      const latlng: L.LatLngExpression = [courier.position.lat, courier.position.lng];
      const pulseOnce = this.stalePulseIds.has(courier.id);
      const html = this.markerHtml(courier, pulseOnce);
      let entry = this.markers.get(courier.id);

      if (!entry) {
        const icon = L.divIcon({
          className: '',
          html,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker(latlng, { icon }).addTo(this.map!);
        marker.on('click', () => this.selectCourier.emit(courier.id));
        marker.bindTooltip(this.tooltipHtml(courier), {
          direction: 'top',
          className: 'dispatch-tooltip',
          sticky: true,
        });
        entry = { marker, lastState: courier.tracking_state };
        this.markers.set(courier.id, entry);
      } else {
        entry.marker.setLatLng(latlng);
        entry.marker.setIcon(
          L.divIcon({
            className: '',
            html,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        );
        entry.marker.setTooltipContent(this.tooltipHtml(courier));
        entry.lastState = courier.tracking_state;
      }

      if (pulseOnce) {
        this.stalePulseIds.delete(courier.id);
      }
    }

    for (const [id, entry] of this.markers) {
      if (!seen.has(id)) {
        entry.marker.remove();
        this.markers.delete(id);
      }
    }

    this.renderLandmarks();
    this.renderRoute(visible);
  }

  private markerHtml(courier: Courier, pulseOnce: boolean): string {
    const selected = courier.id === this.selectedId;
    const cls = markerClass(courier.tracking_state, selected, pulseOnce);
    const label = selected
      ? `<span class="dispatch-marker-label">${courier.id}</span>`
      : '';
    return `<div class="${cls}">${label}</div>`;
  }

  private tooltipHtml(courier: Courier): string {
    return `<strong>${courier.id}</strong> · ${courier.name}<br><span class="mono">${trackingStateShortLabel(courier.tracking_state)}</span>`;
  }

  private renderLandmarks(): void {
    if (!this.map) return;
    for (const m of this.landmarkMarkers) m.remove();
    this.landmarkMarkers = [];

    for (const lm of this.landmarks) {
      const icon = L.divIcon({
        className: 'landmark-marker',
        html: `<span class="landmark-marker__label">${lm.name}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([lm.pos.lat, lm.pos.lng], { icon, interactive: false }).addTo(
        this.map,
      );
      this.landmarkMarkers.push(marker);
    }
  }

  private renderRoute(visible: Courier[]): void {
    if (!this.map) return;

    this.routeBg?.remove();
    this.routeFg?.remove();
    this.routeBg = undefined;
    this.routeFg = undefined;

    const selected = visible.find((c) => c.id === this.selectedId);
    if (!selected || selected.route.length < 2) return;

    const pts = routePointsToLatLngs(selected.route);
    this.routeBg = L.polyline(pts, { color: '#ffffff', weight: 6, opacity: 0.95 }).addTo(this.map);
    this.routeFg = L.polyline(pts, { color: '#1672e8', weight: 3, opacity: 0.9 }).addTo(this.map);
  }
}
