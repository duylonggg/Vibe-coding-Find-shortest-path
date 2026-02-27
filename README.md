# Vibe-coding-Find-shortest-map

Dự án vibe coding tìm đường đi ngắn nhất giữa 2 điểm bất kỳ được đánh dấu trên bản đồ thế giới nằm trong bán kính nhất định 🌏

## Features

- 🗺️ Interactive world map (Leaflet.js) centred on your current location
- 🔍 Location search powered by OpenStreetMap Nominatim
- 🧭 Four pathfinding algorithms: **BFS**, **Dijkstra**, **Bidirectional BFS**, **A\***
- ▶️ Run button to execute the selected algorithm
- ⏮️ Step-by-step replay slider to rewind/fast-forward the exploration
- 🗑️ Clear button to reset all markers and the path
- Right-click → place **Start** marker (green) · Left-click → place **End** marker (red)

## Tech Stack

- React 19 + TypeScript + Vite
- [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
  Algorithm/        # BFS, Dijkstra, Bidirectional BFS, A* implementations
  components/       # MapView, SearchBar, Sidebar, ProgressSlider
  pages/            # ShortestPath main page
```
