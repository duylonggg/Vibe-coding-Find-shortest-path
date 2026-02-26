import Map from "./Map";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const lightTheme = createTheme({
    palette: {
        mode: "light",
    },
});

function App() {
    return (
        <ThemeProvider theme={lightTheme}>
            <CssBaseline />
            <Map/>
        </ThemeProvider>
    );
}

export default App;
