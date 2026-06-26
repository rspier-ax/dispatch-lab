package domain

import "time"

type TrackingState string

const (
	TrackingLive    TrackingState = "live"
	TrackingStale   TrackingState = "stale"
	TrackingOffline TrackingState = "offline"
)

type DeliveryStatus string

const (
	StatusPickingUp DeliveryStatus = "picking_up"
	StatusInTransit DeliveryStatus = "in_transit"
	StatusDelivered DeliveryStatus = "delivered"
)

type MapBounds struct {
	MinLng    float64 `json:"min_lng"`
	MaxLng    float64 `json:"max_lng"`
	MinLat    float64 `json:"min_lat"`
	MaxLat    float64 `json:"max_lat"`
	CenterLat float64 `json:"center_lat"`
	CenterLng float64 `json:"center_lng"`
}

type Position struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type Landmark struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Pos  Position `json:"pos"`
}

type RoutePoint struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type CourierDef struct {
	ID         string       `json:"id"`
	Name       string       `json:"name"`
	Route      []RoutePoint `json:"route"`
	SpeedMPS   float64      `json:"speed_mps"`
	DeliveryID string       `json:"delivery_id"`
}

type DeliveryDef struct {
	ID           string         `json:"id"`
	CourierID    string         `json:"courier_id"`
	Restaurant   string         `json:"restaurant"`
	Street       string         `json:"street"`
	Pickup       Position       `json:"pickup"`
	Dropoff      Position       `json:"dropoff"`
	Status       DeliveryStatus `json:"status"`
	CustomerName string         `json:"customer_name"`
}

type ScriptAction struct {
	CourierID string `json:"courier_id"`
	Tick      int    `json:"tick"`
	Action    string `json:"action"`
}

type Scenario struct {
	Seed        int            `json:"seed"`
	MapBounds   MapBounds      `json:"map_bounds"`
	Landmarks   []Landmark     `json:"landmarks"`
	Couriers    []CourierDef   `json:"couriers"`
	Deliveries  []DeliveryDef  `json:"deliveries"`
	Scripts     []ScriptAction `json:"scripts"`
}

type Courier struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Position      Position      `json:"position"`
	TrackingState TrackingState `json:"tracking_state"`
	LastSeenAt    time.Time     `json:"last_seen_at"`
	Route         []RoutePoint  `json:"route"`
	RouteIndex    int           `json:"route_index"`
	RouteProgress float64       `json:"route_progress"`
	SpeedMPS      float64       `json:"speed_mps"`
	DeliveryID    string        `json:"delivery_id"`
	ETASeconds    int           `json:"eta_seconds"`
}

type Delivery struct {
	ID           string         `json:"id"`
	CourierID    string         `json:"courier_id"`
	CourierName  string         `json:"courier_name"`
	Restaurant   string         `json:"restaurant"`
	Street       string         `json:"street"`
	Pickup       Position       `json:"pickup"`
	Dropoff      Position       `json:"dropoff"`
	Status       DeliveryStatus `json:"status"`
	CustomerName string         `json:"customer_name"`
	ETASeconds   int            `json:"eta_seconds"`
}

type TimelineEvent struct {
	ID        string    `json:"id"`
	CourierID string    `json:"courier_id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

type ScenarioSnapshot struct {
	MapBounds  MapBounds  `json:"map_bounds"`
	Landmarks  []Landmark `json:"landmarks"`
	Couriers   []Courier  `json:"couriers"`
	Deliveries []Delivery `json:"deliveries"`
	Tick       int        `json:"tick"`
}

type CourierDetail struct {
	Courier  Courier         `json:"courier"`
	Delivery *Delivery       `json:"delivery,omitempty"`
	Timeline []TimelineEvent `json:"timeline"`
}

type StreamEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type PositionUpdate struct {
	CourierID string    `json:"courier_id"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	Timestamp time.Time `json:"timestamp"`
}

type TrackingStateChange struct {
	CourierID     string        `json:"courier_id"`
	TrackingState TrackingState `json:"tracking_state"`
	LastSeenAt    time.Time     `json:"last_seen_at"`
}

type DeliveryEventPayload struct {
	DeliveryID string         `json:"delivery_id"`
	CourierID  string         `json:"courier_id"`
	Type       string         `json:"type"`
	Status     DeliveryStatus `json:"status,omitempty"`
	Message    string         `json:"message"`
	Timestamp  time.Time      `json:"timestamp"`
}

type ETAUpdate struct {
	DeliveryID string `json:"delivery_id"`
	CourierID  string `json:"courier_id"`
	ETASeconds int    `json:"eta_seconds"`
}

type TickUpdate struct {
	Tick         int            `json:"tick"`
	IntervalMS   int            `json:"interval_ms"`
	NextScripts  []ScriptAction `json:"next_scripts,omitempty"`
}

type DemoScenario struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CourierID   string `json:"courier_id,omitempty"`
	DeliveryID  string `json:"delivery_id,omitempty"`
}

type ScenarioPreview struct {
	CanApply         bool           `json:"can_apply"`
	BlockReason      string         `json:"block_reason,omitempty"`
	RequiresReset    bool           `json:"requires_reset"`
	SummaryLines     []string       `json:"summary_lines"`
	FocusedCourierID string         `json:"focused_courier_id,omitempty"`
	DeliveryID       string         `json:"delivery_id,omitempty"`
	FitMap           bool           `json:"fit_map,omitempty"`
	Scripts          []ScriptAction `json:"scripts,omitempty"`
}

// ActionPreview is the shared preview shape for demo actions (reset, etc.).
type ActionPreview struct {
	CanApply      bool     `json:"can_apply"`
	BlockReason   string   `json:"block_reason,omitempty"`
	RequiresReset bool     `json:"requires_reset"`
	SummaryLines  []string `json:"summary_lines"`
}

type ScenarioApplyResult struct {
	FocusedCourierID string         `json:"focused_courier_id,omitempty"`
	DeliveryID       string         `json:"delivery_id,omitempty"`
	ResetPerformed   bool           `json:"reset_performed"`
	FitMap           bool           `json:"fit_map"`
	QueueFocus       bool           `json:"queue_focus,omitempty"`
	OpenControlTab   bool           `json:"open_control_tab,omitempty"`
	Scripts          []ScriptAction `json:"scripts,omitempty"`
	UIHint           string         `json:"ui_hint,omitempty"`
}

type DemoInfo struct {
	Tick             int            `json:"tick"`
	IntervalMS       int            `json:"interval_ms"`
	Scripts          []ScriptAction `json:"scripts"`
	Scenarios        []DemoScenario `json:"scenarios"`
	ControlsEnabled  bool           `json:"controls_enabled"`
	ScenarioSeed     int            `json:"scenario_seed"`
	SessionNonce     int            `json:"session_nonce,omitempty"`
}
