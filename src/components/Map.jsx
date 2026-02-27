import DeckGL from "@deck.gl/react";
import { Map as MapGL } from "react-map-gl";
import maplibregl from "maplibre-gl";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "deck.gl";
import { TripsLayer } from "@deck.gl/geo-layers";
import { createGeoJSONCircle } from "../helpers";
import { useEffect, useRef, useState } from "react";
import { getBoundingBoxFromPolygon, getMapGraph, getNearestNode } from "../services/MapService";
import PathfindingState from "../models/PathfindingState";
import Interface from "./Interface";
import { INITIAL_COLORS, INITIAL_VIEW_STATE, MAP_STYLE, MAP_STYLE_DARK } from "../config";
import useSmoothStateChange from "../hooks/useSmoothStateChange";

/** Haversine distance in km between two {lat, lon} points. */
function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lon - a.lon) * Math.PI / 180;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function Map({ isDark = false, onToggleDark }) {
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [selectionRadius, setSelectionRadius] = useState([]);
    const [tripsData, setTripsData] = useState([]);
    const [started, setStarted] = useState();
    const [time, setTime] = useState(0);
    const [animationEnded, setAnimationEnded] = useState(false);
    const [playbackOn, setPlaybackOn] = useState(false);
    const [playbackDirection, setPlaybackDirection] = useState(1);
    const [fadeRadiusReverse, setFadeRadiusReverse] = useState(false);
    const [cinematic, setCinematic] = useState(false);
    const [placeEnd, setPlaceEnd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({ algorithm: "astar", radius: 4, speed: 5 });
    const [colors, setColors] = useState(INITIAL_COLORS);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const ui = useRef();
    const fadeRadius = useRef();
    const requestRef = useRef();
    const previousTimeRef = useRef();
    const timer = useRef(0);
    const waypoints = useRef([]);
    const state = useRef(new PathfindingState());
    const traceNode = useRef(null);
    const traceNode2 = useRef(null);
    const selectionRadiusOpacity = useSmoothStateChange(0, 0, 1, 400, fadeRadius.current, fadeRadiusReverse);

    async function mapClick(e, info, radius = null) {
        if(started && !animationEnded) return;

        setFadeRadiusReverse(false);
        fadeRadius.current = true;
        clearPath();

        // Place end node
        if(info.rightButton || placeEnd) {
            if(e.layer?.id !== "selection-radius") {
                ui.current.showSnack("Please select a point inside the radius.", "info");
                return;
            }

            if(loading) {
                ui.current.showSnack("Please wait for all data to load.", "info");
                return;
            }

            const loadingHandle = setTimeout(() => {
                setLoading(true);
            }, 300);
            
            const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
            if(!node) {
                ui.current.showSnack("No path was found in the vicinity, please try another location.");
                clearTimeout(loadingHandle);
                setLoading(false);
                return;
            }

            const realEndNode = state.current.getNode(node.id);
            setEndNode(node);
            
            clearTimeout(loadingHandle);
            setLoading(false);

            if(!realEndNode) {
                ui.current.showSnack("An error occurred. Please try again.");
                return;
            }
            state.current.endNode = realEndNode;
            
            return;
        }

        const loadingHandle = setTimeout(() => {
            setLoading(true);
        }, 300);

        // Fetch nearest node
        const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
        if(!node) {
            ui.current.showSnack("No path was found in the vicinity, please try another location.");
            clearTimeout(loadingHandle);
            setLoading(false);
            return;
        }

        setStartNode(node);
        setEndNode(null);
        const circle = createGeoJSONCircle([node.lon, node.lat], radius ?? settings.radius);
        setSelectionRadius([{ contour: circle}]);
        
        // Fetch nodes inside the radius
        getMapGraph(getBoundingBoxFromPolygon(circle), node.id).then(graph => {
            state.current.graph = graph;
            clearPath();
            clearTimeout(loadingHandle);
            setLoading(false);
        });
    }

    // Start new pathfinding animation
    function startPathfinding() {
        setFadeRadiusReverse(true);
        setTimeout(() => {
            clearPath();
            state.current.start(settings.algorithm);
            setStarted(true);
        }, 400);
    }

    // Animate the pathfinding
    function animate(newTime) {
        if(animationEnded) return;

        if(previousTimeRef.current !== undefined) {
            const deltaTime = newTime - previousTimeRef.current;

            setTime(prevTime => {
                const updatedTime = prevTime + deltaTime * (settings.speed / 10);

                if(state.current.finished && updatedTime >= timer.current) {
                    setAnimationEnded(true);
                    setPlaybackOn(false);
                    return timer.current;
                }

                while(timer.current <= updatedTime) {
                    const updatedNodes = state.current.nextStep();
                    
                    for(const node of updatedNodes) {
                        if(!node) continue;

                        const refNode = node.referer;
                        if(!refNode) continue;
                        
                        let color = "path";
                        if(state.current.finished) {
                            color = "route";
                        }

                        waypoints.current.push({
                            path: [[refNode.longitude, refNode.latitude], [node.longitude, node.latitude]],
                            timestamps: [timer.current, timer.current + 1],
                            color,
                        });
                        timer.current += 1;
                    }

                    if(state.current.finished) {
                        // Trace back the path
                        let currentNode = state.current.endNode;
                        const pathWaypoints = [];
                        traceNode.current = currentNode;

                        while(currentNode?.parent) {
                            const parent = currentNode.parent;
                            pathWaypoints.unshift({
                                path: [[parent.longitude, parent.latitude], [currentNode.longitude, currentNode.latitude]],
                                timestamps: [timer.current, timer.current + 1],
                                color: "route",
                            });
                            timer.current += 1;
                            currentNode = parent;
                        }

                        waypoints.current.push(...pathWaypoints);
                        setTripsData([...waypoints.current]);
                        return updatedTime;
                    }
                }

                setTripsData([...waypoints.current]);
                return updatedTime;
            });
        }
        previousTimeRef.current = newTime;
        requestRef.current = requestAnimationFrame(animate);
    }

    // Toggle animation playback
    function toggleAnimation(keepDirection = true, direction = 1) {
        if(!keepDirection) {
            setPlaybackDirection(direction);
        }
        setPlaybackOn(prev => !prev);
    }

    // Clear the current path
    function clearPath() {
        setTripsData([]);
        waypoints.current = [];
        timer.current = 0;
        traceNode.current = null;
        traceNode2.current = null;
        setTime(0);
        setStarted(false);
        setAnimationEnded(false);
        setPlaybackOn(false);
        previousTimeRef.current = undefined;
        state.current.reset();
    }

    // Fly to a location
    function changeLocation(coords) {
        setViewState({
            longitude: coords.longitude ?? coords.lon,
            latitude: coords.latitude ?? coords.lat,
            zoom: 13,
            transitionDuration: 2000,
            transitionInterpolator: new FlyToInterpolator(),
        });
    }

    function changeColors(newColors) {
        setColors(newColors);
        localStorage.setItem("path_settings", JSON.stringify({ settings, colors: newColors }));
    }

    function changeSettings(newSettings) {
        setSettings(newSettings);
        localStorage.setItem("path_settings", JSON.stringify({ settings: newSettings, colors }));
    }

    function changeAlgorithm(algorithm) {
        clearPath();
        changeSettings({ ...settings, algorithm });
    }

    function changeRadius(radius) {
        changeSettings({...settings, radius});
        if(startNode) {
            mapClick({coordinate: [startNode.lon, startNode.lat]}, {}, radius);
        }
    }

    async function setStartByCoords(lat, lng) {
        if(started && !animationEnded) return;
        setFadeRadiusReverse(false);
        fadeRadius.current = true;
        clearPath();

        const loadingHandle = setTimeout(() => setLoading(true), 300);
        const node = await getNearestNode(lat, lng);
        if(!node) {
            ui.current.showSnack("No road found near this location, please try another.", "error");
            clearTimeout(loadingHandle);
            setLoading(false);
            return;
        }

        setStartNode(node);
        setEndNode(null);
        const circle = createGeoJSONCircle([node.lon, node.lat], settings.radius);
        setSelectionRadius([{ contour: circle }]);
        changeLocation({ lat: node.lat, lon: node.lon });

        getMapGraph(getBoundingBoxFromPolygon(circle), node.id).then(graph => {
            state.current.graph = graph;
            clearPath();
            clearTimeout(loadingHandle);
            setLoading(false);
        });
    }

    async function setEndByCoords(lat, lng) {
        if(!startNode) {
            ui.current.showSnack("Please set a start point first.", "info");
            return;
        }
        if(started && !animationEnded) return;
        if(loading) {
            ui.current.showSnack("Please wait for data to load.", "info");
            return;
        }

        const dist = haversineKm(startNode, { lat, lon: lng });
        if(dist > settings.radius) {
            ui.current.showSnack(
                `End point is ${dist.toFixed(1)} km from start, outside the search radius (${settings.radius} km). ` +
                `Increase the radius in the Settings panel or choose a closer location.`,
                "warning"
            );
            return;
        }

        const loadingHandle = setTimeout(() => setLoading(true), 300);
        const node = await getNearestNode(lat, lng);
        if(!node) {
            ui.current.showSnack("No road found near this location, please try another.", "error");
            clearTimeout(loadingHandle);
            setLoading(false);
            return;
        }

        const realEndNode = state.current.getNode(node.id);
        setEndNode(node);
        clearTimeout(loadingHandle);
        setLoading(false);

        if(!realEndNode) {
            ui.current.showSnack("End point is not connected to the road network. Try another location.", "error");
            return;
        }
        state.current.endNode = realEndNode;
    }

    useEffect(() => {
        if(!started) return;
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [started, time, animationEnded, playbackOn]);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(res => {
            changeLocation(res.coords);
        });

        const savedSettings = localStorage.getItem("path_settings");
        if(!savedSettings) return;
        const items = JSON.parse(savedSettings);

        setSettings(items.settings);
        setColors(items.colors);
    }, []);

    return (
        <>
            <div onContextMenu={(e) => { e.preventDefault(); }}>
                <DeckGL
                    initialViewState={viewState}
                    controller={{ doubleClickZoom: false, keyboard: false }}
                    onClick={mapClick}
                >
                    <PolygonLayer 
                        id={"selection-radius"}
                        data={selectionRadius}
                        pickable={true}
                        stroked={true}
                        getPolygon={d => d.contour}
                        getFillColor={[80, 210, 0, 10]}
                        getLineColor={[9, 142, 46, 175]}
                        getLineWidth={3}
                        opacity={selectionRadiusOpacity}
                    />
                    <TripsLayer
                        id={"pathfinding-layer"}
                        data={tripsData}
                        opacity={1}
                        widthMinPixels={3}
                        widthMaxPixels={5}
                        fadeTrail={false}
                        currentTime={time}
                        getColor={d => colors[d.color]}
                        updateTriggers={{
                            getColor: [colors.path, colors.route]
                        }}
                    />
                    <ScatterplotLayer 
                        id="start-end-points"
                        data={[
                            ...(startNode ? [{ coordinates: [startNode.lon, startNode.lat], color: colors.startNodeFill, lineColor: colors.startNodeBorder }] : []),
                            ...(endNode ? [{ coordinates: [endNode.lon, endNode.lat], color: colors.endNodeFill, lineColor: colors.endNodeBorder }] : []),
                        ]}
                        pickable={true}
                        opacity={1}
                        stroked={true}
                        filled={true}
                        radiusScale={1}
                        radiusMinPixels={7}
                        radiusMaxPixels={20}
                        lineWidthMinPixels={1}
                        lineWidthMaxPixels={3}
                        getPosition={d => d.coordinates}
                        getFillColor={d => d.color}
                        getLineColor={d => d.lineColor}
                    />
                    <MapGL 
                        reuseMaps mapLib={maplibregl} 
                        mapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE} 
                        doubleClickZoom={false}
                    />
                </DeckGL>
            </div>
            <Interface 
                ref={ui}
                canStart={startNode && endNode}
                started={started}
                animationEnded={animationEnded}
                playbackOn={playbackOn}
                time={time}
                startPathfinding={startPathfinding}
                toggleAnimation={toggleAnimation}
                clearPath={clearPath}
                timeChanged={setTime}
                changeLocation={changeLocation}
                maxTime={timer.current}
                settings={settings}
                setSettings={changeSettings}
                changeAlgorithm={changeAlgorithm}
                colors={colors}
                setColors={changeColors}
                loading={loading}
                cinematic={cinematic}
                setCinematic={setCinematic}
                placeEnd={placeEnd}
                setPlaceEnd={setPlaceEnd}
                changeRadius={changeRadius}
                isDark={isDark}
                onToggleDark={onToggleDark}
                onSetStart={setStartByCoords}
                onSetEnd={setEndByCoords}
            />
            <div className="attrib-container">
                <div className="maplibregl-ctrl-attrib-inner">
                    © <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>, 
                    © <a href="http://www.openstreetmap.org/about/" target="_blank">OpenStreetMap</a> contributors
                </div>
            </div>
        </>
    );
}

export default Map;
