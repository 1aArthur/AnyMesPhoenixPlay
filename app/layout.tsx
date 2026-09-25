import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'AnyMesPhoenixPlay', description: 'Descubra animes com AniList e Kitsu' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body style={{background:'#080a10',color:'#fff',fontFamily:'system-ui'}}>{children}</body></html>; }
