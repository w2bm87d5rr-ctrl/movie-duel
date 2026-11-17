import './globals.css';
export const viewport = {width:'device-width',initialScale:1};
export const metadata = {title:'Movie Duel · Elegí tu campeona',description:'20 duelos. Una sola película campeona. Elegí tus favoritas entre grandes historias del cine.'};
export default function Layout({children}) {return <html lang="es"><body>{children}</body></html>}
