import { Button, IconButton, Typography, Snackbar, Alert, CircularProgress, Fade, Tooltip, Drawer, MenuItem, Select, InputLabel, FormControl, Menu, Backdrop, Stepper, Step, StepLabel } from "@mui/material";
import { MuiColorInput } from "mui-color-input";
import { PlayArrow, Settings, Movie, Pause, Replay } from "@mui/icons-material";
import Slider from "./Slider";
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { INITIAL_COLORS, LOCATIONS } from "../config";
import { arrayToRgb, rgbToArray } from "../helpers";
import LocationAutocomplete from "./LocationAutocomplete";

const Interface = forwardRef(({ canStart, started, animationEnded, playbackOn, time, maxTime, settings, colors, loading, timeChanged, cinematic, placeEnd, changeRadius, changeAlgorithm, setPlaceEnd, setCinematic, setSettings, setColors, startPathfinding, toggleAnimation, clearPath, changeLocation, isDark = false, onToggleDark, onSetStart, onSetEnd, routes = [], activeRouteIndex = 0, onRouteSelect }, ref) => {
    const [sidebar, setSidebar] = useState(false);
    const sidebarBg = isDark ? '#1e293b' : undefined;
    const sidebarText = isDark ? '#e2e8f0' : '#222';
    const sidebarMuted = isDark ? '#94a3b8' : '#888';
    const sidebarLabel = isDark ? '#cbd5e1' : '#555';
    const sidebarInputBg = isDark ? '#0f172a' : '#f5f5f5';
    const sidebarBtnBg = isDark ? '#334155' : '#f0f0f0';
    const sidebarBtnColor = isDark ? '#e2e8f0' : '#333';
    const [snack, setSnack] = useState({
        open: false,
        message: "",
        type: "error",
    });
    const [showTutorial, setShowTutorial] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [helper, setHelper] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const menuOpen = Boolean(menuAnchor);
    const helperTime = useRef(4800);
    const rightDown = useRef(false);
    const leftDown = useRef(false);

    // Expose showSnack to parent from ref
    useImperativeHandle(ref, () => ({
        showSnack(message, type = "error") {
            setSnack({ open: true, message, type });
        },
    }));
      
    function closeSnack() {
        setSnack({...snack, open: false});
    }

    function closeHelper() {
        setHelper(false);
    }

    function handleTutorialChange(direction) {
        if(activeStep >= 2 && direction > 0) {
            setShowTutorial(false);
            return;
        }
        
        setActiveStep(Math.max(activeStep + direction, 0));
    }

    // Start pathfinding or toggle playback
    function handlePlay() {
        if(!canStart) return;
        if(!started && time === 0) {
            startPathfinding();
            return;
        }
        toggleAnimation();
    }
    
    function closeMenu() {
        setMenuAnchor(null);
    }

    window.onkeydown = e => {
        if(e.code === "ArrowRight" && !rightDown.current && !leftDown.current && (!started || animationEnded)) {
            rightDown.current = true;
            toggleAnimation(false, 1);
        }
        else if(e.code === "ArrowLeft" && !leftDown.current && !rightDown.current && animationEnded) {
            leftDown.current = true;
            toggleAnimation(false, -1);
        }
    };

    window.onkeyup = e => {
        if(e.code === "Escape") setCinematic(false);
        else if(e.code === "Space") {
            e.preventDefault();
            handlePlay();
        }
        else if(e.code === "ArrowRight" && rightDown.current) {
            rightDown.current = false;
            toggleAnimation(false, 1);
        }
        else if(e.code === "ArrowLeft" && animationEnded && leftDown.current) {
            leftDown.current = false;
            toggleAnimation(false, 1);
        }
        else if(e.code === "KeyR" && (animationEnded || !started)) clearPath();
    };

    // Toggle dark mode class on document
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, [isDark]);

    // Show cinematic mode helper
    useEffect(() => {
        if(!cinematic) return;
        setHelper(true);
        setTimeout(() => {
            helperTime.current = 2500;
            setHelper(false);
        }, helperTime.current);
    }, [cinematic]);

    const tutorialSteps = [
        {
            label: "Set start",
            content: (
                <div className="content">
                    <h1>How to use</h1>
                    <p>Click anywhere on the map to set the <b>start point</b>. This will load road data for the selected area.</p>
                    <p>After clicking, a green circle marks the search radius. Wait for the data to load before placing the end point.</p>
                    <p>You can change the search radius in the Settings panel.</p>
                </div>
            ),
        },
        {
            label: "Set end",
            content: (
                <div className="content">
                    <h1>Set endpoint</h1>
                    <p><b>Right-click</b> (or use the "Place End" button on mobile) inside the green circle to set the <b>end point</b>.</p>
                    <p>The end point must be inside the loaded road network area.</p>
                </div>
            ),
        },
        {
            label: "Find path",
            content: (
                <div className="content">
                    <h1>Run pathfinding</h1>
                    <p>Press the <b>Play</b> button (or <b>SPACE</b>) to start the animation.</p>
                    <p>Watch the algorithm explore the road network in real-time. The green trail shows exploration, and the red trail marks the shortest path found.</p>
                    <p>Use the slider to replay and inspect any moment of the search.</p>
                    <p>Change algorithms in Settings to compare different strategies!</p>
                </div>
            ),
        },
    ];

    return (
        <>
            <Snackbar open={snack.open} autoHideDuration={5000} onClose={closeSnack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert onClose={closeSnack} severity={snack.type} sx={{ width: "100%" }}>
                    {snack.message}
                </Alert>
            </Snackbar>

            <Fade in={helper}>
                <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 9999, pointerEvents: "none" }}>
                    <div className="cinematic-alert">
                        <b>Cinematic mode</b>
                        <span>Press <b>ESC</b> to exit</span>
                    </div>
                </div>
            </Fade>

            <div className={`nav-top ${cinematic ? "cinematic" : ""}`}>
                <div className="side" style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Tooltip title="Change location">
                        <Button
                            onClick={(e) => setMenuAnchor(e.currentTarget)}
                            variant="contained"
                            style={{ backgroundColor: "#fff", color: "#333", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                        >
                            📍 Locations
                        </Button>
                    </Tooltip>
                    <Menu
                        anchorEl={menuAnchor}
                        open={menuOpen}
                        onClose={closeMenu}
                    >
                        {LOCATIONS.map(loc => (
                            <MenuItem key={loc.name} onClick={() => { changeLocation(loc); closeMenu(); }}>
                                {loc.name}
                            </MenuItem>
                        ))}
                    </Menu>
                </div>

                <div className="slider-container">
                    <Typography style={{ color: "#333", textAlign: "center", fontSize: 13, margin: 0 }}>
                        {animationEnded ? "Animation complete" : started ? "Running…" : "Place start & end, then press Play"}
                    </Typography>
                    <Slider
                        disabled={!animationEnded}
                        value={time}
                        min={0}
                        max={maxTime}
                        step={0.1}
                        onChange={(_, v) => timeChanged(v)}
                    />
                </div>

                <div className="side" style={{ display: "flex", gap: 8 }}>
                    <Tooltip title={placeEnd ? "Cancel placing end" : "Place end node (right-click on map)"}>
                        <Button
                            onClick={() => setPlaceEnd(p => !p)}
                            variant={placeEnd ? "contained" : "outlined"}
                            style={placeEnd
                                ? { backgroundColor: "#c81e1e", color: "#fff", minWidth: 0 }
                                : { backgroundColor: "#fff", color: "#333", minWidth: 0 }}
                        >
                            🏁 End
                        </Button>
                    </Tooltip>
                </div>

                {/* Location search inputs row */}
                {(onSetStart || onSetEnd) && (
                    <div style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        gap: 8,
                        padding: "6px 8px 2px",
                        flexWrap: "wrap",
                    }}>
                        {onSetStart && (
                            <LocationAutocomplete
                                label="🟢 Start:"
                                placeholder="Search start location…"
                                onSelect={(lat, lng) => onSetStart(lat, lng)}
                                isDark={isDark}
                            />
                        )}
                        {onSetEnd && (
                            <LocationAutocomplete
                                label="🔴 End:"
                                placeholder="Search end location…"
                                onSelect={(lat, lng) => onSetEnd(lat, lng)}
                                isDark={isDark}
                            />
                        )}
                    </div>
                )}
            </div>

            <div className={`nav-right ${cinematic ? "cinematic" : ""}`}>
                <Tooltip title={!canStart ? "Set start and end point first" : animationEnded ? "Restart" : playbackOn ? "Pause" : "Play"}>
                    <span>
                        <IconButton
                            disabled={!canStart}
                            onClick={handlePlay}
                            style={{
                                backgroundColor: canStart ? "#2ea064" : "#ccc",
                                color: "#fff",
                                width: 56,
                                height: 56,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                            }}
                        >
                            {animationEnded ? <Replay /> : playbackOn ? <Pause /> : <PlayArrow />}
                        </IconButton>
                    </span>
                </Tooltip>

                <Tooltip title="Clear path">
                    <IconButton
                        onClick={clearPath}
                        style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            width: 48,
                            height: 48,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                        }}
                    >
                        <Replay />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Settings">
                    <IconButton
                        onClick={() => setSidebar(true)}
                        style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            width: 48,
                            height: 48,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                        }}
                    >
                        <Settings />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Cinematic mode">
                    <IconButton
                        className="btn-cinematic"
                        onClick={() => setCinematic(true)}
                        style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            width: 48,
                            height: 48,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
                        }}
                    >
                        <Movie />
                    </IconButton>
                </Tooltip>
            </div>

            {loading && (
                <div className="loader-container">
                    <CircularProgress style={{ color: "#2ea064" }} />
                </div>
            )}

            {routes.length > 0 && (
                <div style={{
                    position: "fixed",
                    left: 16,
                    bottom: 16,
                    zIndex: 2500,
                    minWidth: 230,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: `1px solid ${isDark ? "#334155" : "#d1d5db"}`,
                    background: isDark ? "#0f172a" : "#fff",
                    boxShadow: isDark ? "0 2px 10px rgba(0,0,0,0.5)" : "0 2px 10px rgba(0,0,0,0.2)",
                }}>
                    {routes.map((route, index) => {
                        const isActive = index === activeRouteIndex;
                        const decimals = route.distanceKm >= 10 ? 1 : 2;
                        return (
                            <button
                                key={`${route.label}-${index}`}
                                type="button"
                                onClick={() => onRouteSelect?.(index)}
                                style={{
                                    width: "100%",
                                    border: "none",
                                    borderBottom: index < routes.length - 1 ? `1px solid ${isDark ? "#334155" : "#e5e7eb"}` : "none",
                                    background: isActive ? (isDark ? "#1e293b" : "#f3f4f6") : "transparent",
                                    color: isDark ? "#e2e8f0" : "#1f2937",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    padding: "10px 12px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                }}
                            >
                                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600 }}>
                                    {route.label}{index === 0 ? " (recommended)" : ""}
                                </span>
                                <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#6b7280" }}>
                                    {route.distanceKm.toFixed(decimals)} km • {route.algorithm}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <Drawer
                anchor="left"
                open={sidebar}
                onClose={() => setSidebar(false)}
                className={`side-drawer ${cinematic ? "cinematic" : ""}`}
                PaperProps={{ style: sidebarBg ? { backgroundColor: sidebarBg } : undefined }}
            >
                <div className="sidebar-container">
                    <Typography variant="h6" style={{ color: sidebarText }}>
                        Settings
                    </Typography>

                    <FormControl fullWidth>
                        <InputLabel id="algo-label" style={{ color: sidebarLabel }}>Algorithm</InputLabel>
                        <Select
                            labelId="algo-label"
                            value={settings.algorithm}
                            label="Algorithm"
                            onChange={e => changeAlgorithm(e.target.value)}
                            style={{ backgroundColor: sidebarInputBg, color: sidebarText }}
                        >
                            <MenuItem value="bfs">BFS (Breadth-First Search)</MenuItem>
                            <MenuItem value="dijkstra">Dijkstra</MenuItem>
                            <MenuItem value="greedy">Greedy Best-First Search</MenuItem>
                            <MenuItem value="astar">A* (A-Star)</MenuItem>
                            <MenuItem value="alt">ALT (A* + Landmarks)</MenuItem>
                            <MenuItem value="bidirectional">Bidirectional Search</MenuItem>
                        </Select>
                    </FormControl>

                    <div>
                        <Typography id="speed-label" style={{ color: sidebarLabel, fontSize: 14 }}>
                            Animation speed: {settings.speed}
                        </Typography>
                        <Slider
                            value={settings.speed}
                            min={1}
                            max={100}
                            step={1}
                            onChange={(_, v) => setSettings({ ...settings, speed: v })}
                            style={{ color: "#2ea064" }}
                        />
                    </div>

                    <div>
                        <Typography id="radius-label" style={{ color: sidebarLabel, fontSize: 14 }}>
                            Search radius: {settings.radius} km
                        </Typography>
                        <Slider
                            value={settings.radius}
                            min={1}
                            max={100}
                            step={1}
                            onChange={(_, v) => changeRadius(v)}
                            style={{ color: "#2ea064" }}
                        />
                    </div>

                    <div className="styles-container">
                        <Typography style={{ color: sidebarMuted, textTransform: "uppercase", fontSize: 13 }}>
                            Colors
                        </Typography>

                        {[
                            { label: "Start node fill", key: "startNodeFill" },
                            { label: "Start node border", key: "startNodeBorder" },
                            { label: "End node fill", key: "endNodeFill" },
                            { label: "End node border", key: "endNodeBorder" },
                            { label: "Path color", key: "path" },
                            { label: "Shortest route color", key: "route" },
                        ].map(({ label, key }) => (
                            <div key={key}>
                                <Typography style={{ color: sidebarLabel, fontSize: 13 }}>{label}</Typography>
                                <div className="color-container">
                                    <MuiColorInput
                                        value={arrayToRgb(colors[key])}
                                        onChange={v => setColors({ ...colors, [key]: rgbToArray(v) })}
                                        style={{ backgroundColor: sidebarInputBg }}
                                    />
                                    <IconButton
                                        onClick={() => setColors({ ...colors, [key]: INITIAL_COLORS[key] })}
                                        style={{ backgroundColor: "transparent" }}
                                        size="small"
                                    >
                                        <Replay style={{ color: sidebarLabel, width: 20, height: 20 }} fontSize="inherit" />
                                    </IconButton>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="shortcuts-container">
                        <Typography style={{ color: sidebarMuted, textTransform: "uppercase", fontSize: 13 }}>
                            Shortcuts
                        </Typography>
                        <div className="shortcut" style={{ color: sidebarLabel }}><p>SPACE</p><p>Start/Stop animation</p></div>
                        <div className="shortcut" style={{ color: sidebarLabel }}><p>R</p><p>Clear path</p></div>
                        <div className="shortcut" style={{ color: sidebarLabel }}><p>Arrows</p><p>Animation playback</p></div>
                        <Button
                            onClick={() => { setActiveStep(0); setShowTutorial(true); }}
                            variant="contained"
                            style={{ backgroundColor: sidebarBtnBg, color: sidebarBtnColor, marginTop: 8 }}
                        >
                            Show tutorial
                        </Button>
                    </div>
                </div>
            </Drawer>

            <Backdrop open={showTutorial} onClick={() => setShowTutorial(false)} style={{ zIndex: 9000 }}>
                <div className="tutorial-container" onClick={e => e.stopPropagation()}>
                    <Stepper activeStep={activeStep} style={{ marginBottom: 20 }}>
                        {tutorialSteps.map(s => (
                            <Step key={s.label}><StepLabel>{s.label}</StepLabel></Step>
                        ))}
                    </Stepper>
                    {tutorialSteps[activeStep].content}
                    <div className="controls">
                        <Button className="close" onClick={() => setShowTutorial(false)} variant="outlined" style={{ color: "#333", borderColor: "#ccc" }}>
                            Close
                        </Button>
                        {activeStep > 0 && (
                            <Button onClick={() => handleTutorialChange(-1)} variant="outlined" style={{ color: "#333", borderColor: "#ccc" }}>
                                Back
                            </Button>
                        )}
                        <Button onClick={() => handleTutorialChange(1)} variant="contained" style={{ backgroundColor: "#2ea064", color: "#fff" }}>
                            {activeStep >= 2 ? "Done" : "Next"}
                        </Button>
                    </div>
                </div>
            </Backdrop>

            <div className="mobile-controls">
                <IconButton
                    onClick={handlePlay}
                    disabled={!canStart}
                    style={{
                        backgroundColor: canStart ? "#2ea064" : "#ccc",
                        color: "#fff",
                        margin: "0 8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                    }}
                >
                    {animationEnded ? <Replay /> : playbackOn ? <Pause /> : <PlayArrow />}
                </IconButton>
            </div>

            <Tooltip title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}>
                <button
                    onClick={onToggleDark}
                    aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    className="dark-mode-toggle"
                >
                    <span className={`toggle-icon ${isDark ? "dark" : "light"}`}>
                        {isDark ? "🌙" : "☀️"}
                    </span>
                </button>
            </Tooltip>
        </>
    );
});

Interface.displayName = "Interface";

export default Interface;
