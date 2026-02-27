import Map from "./Map";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useState } from "react";

function App() {
    const [isDark, setIsDark] = useState(false);

    const theme = createTheme({
        palette: {
            mode: isDark ? "dark" : "light",
        },
    });

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Map isDark={isDark} onToggleDark={() => setIsDark(d => !d)} />
        </ThemeProvider>
    );
}

export default App;
