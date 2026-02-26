// Use CARTO Positron for a clean white/light map style
export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export const INITIAL_VIEW_STATE = {
    longitude: -0.127,
    latitude:  51.507,
    zoom: 13,
    pitch: 0,
    bearing: 0
};

// Colors adapted for visibility on white/light map background
export const INITIAL_COLORS = {
    startNodeFill: [46, 160, 100],
    startNodeBorder: [255, 255, 255],
    endNodeFill: [200, 30, 30],
    endNodeBorder: [80, 0, 0],
    path: [46, 160, 100],
    route: [200, 30, 30],
};

export const LOCATIONS = [
    { name: "New York", latitude: 40.712, longitude: -74.006 },
    { name: "Tokyo", latitude: 35.682, longitude: 139.759 },
    { name: "Paris", latitude: 48.856, longitude: 2.352 },
    { name: "Rome", latitude: 41.902, longitude: 12.496 },
    { name: "Prague", latitude: 50.086, longitude: 14.420 },
    { name: "London", latitude: 51.507, longitude: -0.127 },
    { name: "Dubai", latitude: 25.276, longitude: 55.296 },
    { name: "Singapore", latitude: 1.352, longitude: 103.820 },
    { name: "San Francisco", latitude: 37.774, longitude: -122.419 },
    { name: "Berlin", latitude: 52.520, longitude: 13.405 },
    { name: "Sydney", latitude: -33.868, longitude: 151.209 },
    { name: "Amsterdam", latitude: 52.367, longitude: 4.900 },
    { name: "Stockholm", latitude: 59.329, longitude: 18.068 },
    { name: "Hong Kong", latitude: 22.319, longitude: 114.169 },
    { name: "Rio de Janeiro", latitude: -22.906, longitude: -43.172 },
    { name: "Shanghai", latitude: 31.230, longitude: 121.473 },
    { name: "Barcelona", latitude: 41.385, longitude: 2.173 }
];
