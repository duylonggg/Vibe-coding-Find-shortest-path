import { useState, useEffect, useRef, useCallback } from "react";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 7;

/**
 * LocationAutocomplete – a text input that shows a dropdown of location
 * suggestions (via Nominatim) as the user types.
 *
 * Props:
 *   label        – prefix label text (e.g. "🟢 Start:")
 *   placeholder  – input placeholder
 *   onSelect     – called with (lat, lng, displayName) when a suggestion is chosen
 *   isDark       – boolean for dark-mode styling
 */
export default function LocationAutocomplete({ label, placeholder, onSelect, isDark = false }) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debounceTimer = useRef(null);
    const containerRef = useRef(null);

    const borderColor = isDark ? "#334155" : "#d1d5db";
    const inputBg = isDark ? "#0f172a" : "#fff";
    const textColor = isDark ? "#e2e8f0" : "#374151";
    const dropdownBg = isDark ? "#1e293b" : "#fff";
    const dropdownBorder = isDark ? "#334155" : "#e5e7eb";
    const hoverBg = isDark ? "#334155" : "#f3f4f6";
    const activeBg = isDark ? "#2563eb" : "#dbeafe";
    const mutedColor = isDark ? "#94a3b8" : "#6b7280";

    // Fetch suggestions from Nominatim
    const fetchSuggestions = useCallback(async (q) => {
        if (!q.trim()) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        try {
            const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(q)}&limit=${MAX_SUGGESTIONS}&addressdetails=1`;
            const res = await fetch(url, { headers: { "Accept-Language": "vi,en" } });
            const data = await res.json();
            setSuggestions(Array.isArray(data) ? data : []);
            setOpen(true);
            setActiveIndex(-1);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce input changes
    useEffect(() => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(query);
        }, DEBOUNCE_MS);
        return () => clearTimeout(debounceTimer.current);
    }, [query, fetchSuggestions]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(item) {
        setQuery(item.display_name);
        setOpen(false);
        setSuggestions([]);
        if (onSelect) {
            onSelect(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
        }
    }

    function handleKeyDown(e) {
        if (!open || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, -1));
        } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < suggestions.length) {
                e.preventDefault();
                handleSelect(suggestions[activeIndex]);
            } else {
                // commit first suggestion on Enter if nothing is highlighted
                if (suggestions.length > 0) {
                    e.preventDefault();
                    handleSelect(suggestions[0]);
                }
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div
            ref={containerRef}
            style={{ display: "flex", alignItems: "flex-start", gap: 4, flex: "1 1 220px", minWidth: 0, position: "relative" }}
        >
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", color: textColor, paddingTop: 5 }}>
                {label}
            </span>
            <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    aria-autocomplete="list"
                    aria-expanded={open && suggestions.length > 0}
                    autoComplete="off"
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "4px 8px",
                        borderRadius: 5,
                        border: `1px solid ${borderColor}`,
                        fontSize: 12,
                        background: inputBg,
                        color: textColor,
                        outline: "none",
                    }}
                />
                {loading && (
                    <span style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 10,
                        color: mutedColor,
                        pointerEvents: "none",
                    }}>
                        ⏳
                    </span>
                )}
                {open && suggestions.length > 0 && (
                    <ul
                        role="listbox"
                        style={{
                            position: "absolute",
                            top: "calc(100% + 2px)",
                            left: 0,
                            right: 0,
                            zIndex: 9999,
                            margin: 0,
                            padding: "4px 0",
                            listStyle: "none",
                            background: dropdownBg,
                            border: `1px solid ${dropdownBorder}`,
                            borderRadius: 6,
                            boxShadow: isDark
                                ? "0 4px 16px rgba(0,0,0,0.5)"
                                : "0 4px 16px rgba(0,0,0,0.12)",
                            maxHeight: 220,
                            overflowY: "auto",
                        }}
                    >
                        {suggestions.map((item, i) => (
                            <li
                                key={item.place_id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setActiveIndex(i)}
                                aria-label={item.display_name}
                                role="option"
                                aria-selected={i === activeIndex}
                                style={{
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    background: i === activeIndex ? activeBg : "transparent",
                                    color: textColor,
                                    borderBottom: i < suggestions.length - 1 ? `1px solid ${dropdownBorder}` : "none",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                                title={item.display_name}
                            >
                                {item.display_name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
