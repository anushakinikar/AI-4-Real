// app/layout.js
import "./globals.css"; // Global styles applied to every page

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                {/* This children prop will represent your pages and nested layouts */}
                {children}
            </body>
        </html>
    );
}