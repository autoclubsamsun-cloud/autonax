import { redirect } from 'next/navigation';

export default function RootPage() {
  // Ana site standalone HTML'ye yönlendir
  redirect('/standalone/desktop.html');
}
