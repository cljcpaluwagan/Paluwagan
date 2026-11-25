import React, { useEffect } from 'react';
import { liveUpdateReady } from './lib/liveUpdate';
import { AppProvider, useApp, Screen } from './state/AppContext';
import UpdateBanner from './components/UpdateBanner';
import Login from './screens/Login'; import Home from './screens/Home'; import Payments from './screens/Payments'; import Collection from './screens/Collection';
import Schedule from './screens/Schedule'; import Reports from './screens/Reports'; import Messages from './screens/Messages'; import Settings from './screens/Settings';
import PayoutSettings from './screens/PayoutSettings'; import Cycle from './screens/Cycle'; import Members from './screens/Members'; import Branding from './screens/Branding';

import { applyTheme, getTheme } from './lib/theme';
applyTheme(getTheme());   // before first paint
const SCREENS: Record<Screen, React.ComponentType> = { login: Login, home: Home, payments: Payments, collection: Collection, schedule: Schedule, reports: Reports, messages: Messages, settings: Settings, payoutSettings: PayoutSettings, cycle: Cycle, members: Members, branding: Branding };
function Shell() {
  const { screen, user, snap } = useApp();
  useEffect(() => { liveUpdateReady(); }, []);
  const S = !user ? Login : SCREENS[screen];
  return <div className="app"><UpdateBanner /><div className="preview-stage">{user && !snap ? <div className="phone"><p className="center muted" style={{ margin: 'auto' }}>Loading…</p></div> : <S />}</div></div>;
}
export default function App() { return <AppProvider><Shell /></AppProvider>; }
