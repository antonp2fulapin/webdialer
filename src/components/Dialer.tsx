import { useEffect, useMemo, useRef, useState } from 'react';
import JsSIP from 'jssip';

export type DialerProps = {
  title?: string;
};

type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'registered'
  | 'registration-failed';

type CallState = 'idle' | 'calling' | 'in-call' | 'terminated' | 'failed';

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const Dialer = ({ title = 'Web Dialer' }: DialerProps) => {
  const [wsUri, setWsUri] = useState('wss://sip.example.com:7443');
  const [sipUri, setSipUri] = useState('sip:1001@sip.example.com');
  const [displayName, setDisplayName] = useState('Web Agent');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [callState, setCallState] = useState<CallState>('idle');
  const [number, setNumber] = useState('');
  const [logEntries, setLogEntries] = useState<string[]>([]);

  const uaRef = useRef<JsSIP.UA | null>(null);
  const activeSessionRef = useRef<JsSIP.RTCSession | null>(null);

  const addLog = (message: string) => {
    setLogEntries((prev) => [message, ...prev].slice(0, 20));
  };

  const isConnected = useMemo(
    () => status === 'connected' || status === 'registered',
    [status]
  );

  useEffect(() => {
    return () => {
      activeSessionRef.current?.terminate();
      uaRef.current?.stop();
    };
  }, []);

  const connect = () => {
    if (!wsUri || !sipUri || !password) {
      addLog('Please provide WebSocket URL, SIP URI, and password.');
      return;
    }

    try {
      const socket = new JsSIP.WebSocketInterface(wsUri);
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: sipUri,
        password,
        display_name: displayName,
        session_timers: false
      });

      ua.on('connected', () => {
        setStatus('connected');
        addLog('Socket connected.');
      });

      ua.on('disconnected', () => {
        setStatus('disconnected');
        setCallState('terminated');
        addLog('Socket disconnected.');
      });

      ua.on('registered', () => {
        setStatus('registered');
        addLog('Registered with SIP server.');
      });

      ua.on('unregistered', () => {
        setStatus('connected');
        addLog('Unregistered.');
      });

      ua.on('registrationFailed', (e) => {
        setStatus('registration-failed');
        addLog(`Registration failed: ${e.cause || 'unknown'}`);
      });

      ua.on('newRTCSession', (data) => {
        const session = data.session as JsSIP.RTCSession;
        activeSessionRef.current = session;

        const updateState = (state: CallState, message: string) => {
          setCallState(state);
          addLog(message);
        };

        session.on('progress', () => updateState('calling', 'Call in progress...'));
        session.on('confirmed', () => updateState('in-call', 'Call confirmed.'));
        session.on('ended', () => updateState('terminated', 'Call ended.'));
        session.on('failed', (e) =>
          updateState('failed', `Call failed: ${e.cause || 'unknown'}`)
        );
      });

      ua.start();
      uaRef.current = ua;
      setStatus('connecting');
      addLog('Connecting...');
    } catch (error) {
      addLog(`Connection error: ${(error as Error).message}`);
      setStatus('disconnected');
    }
  };

  const disconnect = () => {
    activeSessionRef.current?.terminate();
    uaRef.current?.stop();
    setStatus('disconnected');
    setCallState('terminated');
    addLog('Disconnected from server.');
  };

  const dial = () => {
    if (!uaRef.current || !isConnected) {
      addLog('Connect to the SIP server first.');
      return;
    }

    if (!number) {
      addLog('Enter a destination number.');
      return;
    }

    const eventHandlers = {
      progress: () => setCallState('calling'),
      failed: (e: any) => {
        setCallState('failed');
        addLog(`Call failed: ${e.cause || 'unknown'}`);
      },
      confirmed: () => setCallState('in-call'),
      ended: () => setCallState('terminated')
    };

    const options = {
      eventHandlers,
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        rtcpMuxPolicy: 'require',
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
      }
    } as JsSIP.RTCSessionOptions;

    uaRef.current.call(number, options);
    addLog(`Dialing ${number}...`);
  };

  const hangup = () => {
    if (!activeSessionRef.current) return;
    activeSessionRef.current.terminate();
    setCallState('terminated');
    addLog('Call terminated.');
  };

  const handleKeypad = (digit: string) => {
    setNumber((prev) => (prev + digit).slice(0, 32));
    activeSessionRef.current?.sendDTMF(digit);
  };

  return (
    <div className="dialer-card">
      <div className="dialer-header">
        <div>
          <p className="eyebrow">SIP Web Client</p>
          <h1>{title}</h1>
          <p className="muted">Connect, manage calls, and send DTMF from your browser.</p>
        </div>
        <span className={`status-pill status-${status}`}>
          {status.replace('-', ' ')}
        </span>
      </div>

      <div className="layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Connection</p>
              <h2>Server settings</h2>
              <p className="muted">Configure your SIP endpoint and register.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>WebSocket URL</span>
              <input
                type="text"
                value={wsUri}
                onChange={(e) => setWsUri(e.target.value)}
                placeholder="wss://..."
              />
            </label>
            <label className="field">
              <span>SIP URI</span>
              <input
                type="text"
                value={sipUri}
                onChange={(e) => setSipUri(e.target.value)}
                placeholder="sip:user@example.com"
              />
            </label>
            <label className="field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Caller ID"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </label>
          </div>
          <div className="actions">
            <button className="ghost" onClick={disconnect} disabled={!uaRef.current}>
              Disconnect
            </button>
            <button className="primary" onClick={connect}>
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </section>

        <section className="panel call-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dialer</p>
              <h2>Place a call</h2>
              <p className="muted">Use the keypad to dial or send DTMF while in a call.</p>
            </div>
            <div className="pill-group">
              <span className={`status-pill call-${callState}`}>{callState}</span>
              <span className={`status-pill ${isConnected ? 'status-up' : 'status-down'}`}>
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="number-input">
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Enter destination"
            />
            <div className="number-actions">
              <button className="ghost" onClick={() => setNumber('')}>
                Clear
              </button>
              {activeSessionRef.current ? (
                <button className="danger" onClick={hangup}>
                  Hang up
                </button>
              ) : (
                <button className="primary" onClick={dial} disabled={!isConnected}>
                  Call
                </button>
              )}
            </div>
          </div>

          <div className="keypad">
            {keypad.map((digit) => (
              <button key={digit} className="key" onClick={() => handleKeypad(digit)}>
                {digit}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="panel log-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Activity</p>
            <h2>Event log</h2>
          </div>
        </div>
        {logEntries.length === 0 ? (
          <p className="muted">No events yet. Connect to begin.</p>
        ) : (
          <ul className="log">
            {logEntries.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Dialer;
