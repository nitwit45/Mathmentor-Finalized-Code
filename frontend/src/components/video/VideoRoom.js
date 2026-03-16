import { useEffect, useRef, useState, useCallback } from 'react';
import { HiExclamation } from 'react-icons/hi';
import './VideoRoom.css';

// Module-level tracking (outside component)
let scriptLoadPromise = null;
const initializingRooms = new Set();

// Load JaaS external API script (module-level function)
const loadJitsiScript = (appIdValue) => {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://8x8.vc/${appIdValue}/external_api.js`;
    script.async = true;
    script.onload = () => {
      scriptLoadPromise = null;
      resolve();
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load JaaS script'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
};

/**
 * VideoRoom component - Embeds JaaS (Jitsi) video call within the app
 * 
 * Props:
 * - jwt: The JaaS JWT token for authentication
 * - roomName: Full room name (AppID/RoomName)
 * - appId: JaaS App ID
 * - domain: JaaS domain (8x8.vc)
 * - userInfo: Object with user's name, email
 * - sessionInfo: Object with session topic, duration
 * - onClose: Callback when user ends the call
 * - onParticipantJoined: Callback when another participant joins
 */
function VideoRoom({
  jwt,
  roomName,
  appId,
  domain = '8x8.vc',
  userInfo,
  sessionInfo,
  onClose,
  onParticipantJoined,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const mountIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useMock, setUseMock] = useState(false);

  // Initialize the Jitsi iframe
  const initializeJitsi = async (currentMountId) => {
    // Debounce for StrictMode
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if mount is still current
    if (mountIdRef.current !== currentMountId) {
      if (process.env.NODE_ENV === 'development') console.log('[VideoRoom] Mount ID changed, aborting stale init');
      return;
    }

    if (!containerRef.current || !jwt || !roomName) {
      return;
    }

    // Check if already initializing this room
    if (initializingRooms.has(roomName)) {
      if (process.env.NODE_ENV === 'development') console.log('[VideoRoom] Already initializing this room');
      return;
    }

    initializingRooms.add(roomName);

    try {
      setIsLoading(true);
      setError(null);

      // Check if we're in an embedded environment (like Cursor IDE)
      const isEmbedded = window !== window.top;
      const hasCursorUA = window.navigator.userAgent.includes('Cursor');
      const hasCursorReferrer = document.referrer.includes('cursor.sh') || document.referrer.includes('cursor');

      // Only use mock mode in Cursor IDE or when explicitly detected as embedded development
      if ((isEmbedded || hasCursorUA || hasCursorReferrer) && process.env.NODE_ENV === 'development') {
        if (process.env.NODE_ENV === 'development') console.log('[VideoRoom] Detected embedded development environment, using mock video room');
        setUseMock(true);
        setIsLoading(false);
        return;
      }

      await loadJitsiScript(appId);

      // Clean up any existing instance
      if (apiRef.current) {
        apiRef.current.dispose();
      }

      const options = {
        roomName: roomName,
        parentNode: containerRef.current,
        jwt: jwt,
        width: '100%',
        height: '100%',
        iframeAttributes: {
          allow: 'camera; microphone; display-capture; autoplay; clipboard-write; fullscreen'
        },
        configOverwrite: {
          // Skip prejoin screen - go directly to meeting
          prejoinPageEnabled: false,
          prejoinConfig: {
            enabled: false,
          },
          // Start settings
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          // UI customization
          disableDeepLinking: true,
          enableClosePage: false,
          disableInviteFunctions: true,
          hideConferenceSubject: false,
          // Subject/topic display
          subject: sessionInfo?.topic || 'Tutoring Session',
          // Disable lobby
          enableLobbyChat: false,
          hideLobbyButton: true,
        },
        interfaceConfigOverwrite: {
          // Branding
          APP_NAME: 'MathMentor',
          PROVIDER_NAME: 'MathMentor',
          // Hide some toolbar buttons
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',
            'chat',
            'raisehand',
            'tileview',
            'hangup',
            'settings',
            'fullscreen',
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_LOGO_URL: '',
          HIDE_INVITE_MORE_HEADER: true,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        },
        userInfo: {
          displayName: userInfo?.name || 'Participant',
          email: userInfo?.email || '',
        },
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('[VideoRoom] Initializing with config:', {
          domain,
          roomName,
          jwtLength: jwt?.length,
          appId,
        });
      }

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          const iframe = apiRef.current?.getIFrame();
        if (iframe && process.env.NODE_ENV === 'development') {
          console.log('[VideoRoom] Iframe created');
        } else if (!iframe && process.env.NODE_ENV === 'development') {
          console.warn('[VideoRoom] Iframe not found after creation');
        }
        }, 1000);
      }

      // Set up event listeners
      apiRef.current.addListener('videoConferenceJoined', () => {
        setIsLoading(false);
      });

      apiRef.current.addListener('videoConferenceLeft', () => {
        if (onClose) {
          onClose();
        }
      });

      apiRef.current.addListener('participantJoined', (participant) => {
        if (onParticipantJoined) {
          onParticipantJoined(participant);
        }
      });

      apiRef.current.addListener('readyToClose', () => {
        if (onClose) {
          onClose();
        }
      });

      apiRef.current.addListener('browserSupport', () => {});

      // Authentication and connection error listeners
      apiRef.current.addListener('passwordRequired', () => {
        console.error('[VideoRoom] Password required - JWT may be invalid');
        setError('Authentication failed. Please try again.');
        setIsLoading(false);
      });

      apiRef.current.addListener('suspendDetected', () => {});

      // Handle errors
      apiRef.current.addListener('errorOccurred', (error) => {
        console.error('[VideoRoom] Error occurred:', error);

        // Check for WebRTC support error
        if (error?.message?.includes('WebRTC') || error?.name === 'browser-support') {
           setError('WebRTC video is not supported in this embedded environment. Please open the application in a separate browser window to use video functionality.');
        } else {
           setError(error?.message || 'An error occurred in the video session');
        }
        setIsLoading(false);
      });

      // Add a fallback timeout for when Jitsi fails to load properly
      setTimeout(() => {
        if (!apiRef.current) {
          if (process.env.NODE_ENV === 'development') console.warn('[VideoRoom] Jitsi API never initialized');
          setError('Video functionality is not available in this environment. Please open the application in a full browser window.');
          setIsLoading(false);
        }
      }, 3000);

      apiRef.current.addListener('log', () => {});

      // Timeout fallback - if still loading after 15 seconds, something's wrong
      setTimeout(() => {
        if (isLoading && apiRef.current) {
          setIsLoading(false);
        }
      }, 15000);

    } catch (err) {
      console.error('Failed to initialize video room:', err);
      setError(err.message || 'Failed to start video session');
      setIsLoading(false);
    } finally {
      initializingRooms.delete(roomName);
    }
  };

  // Initialize on mount
  useEffect(() => {
    const currentMountId = ++mountIdRef.current;
    initializeJitsi(currentMountId);

    // Cleanup on unmount
    return () => {
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (e) {
          if (process.env.NODE_ENV === 'development') console.warn('[VideoRoom] Error during dispose:', e);
        }
        apiRef.current = null;
      }
    };
  }, [jwt, roomName, domain, appId, userInfo, sessionInfo, onClose, onParticipantJoined]);

  if (error) {
    return (
      <div className="video-room-error">
        <div className="error-content">
          <span className="error-icon"><HiExclamation /></span>
          <h3>Unable to Start Video</h3>
          <p>{error}</p>
          <button onClick={onClose} className="error-close-btn">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Mock video room for development
  if (useMock) {
    return (
      <div className="video-room-wrapper">
        <div className="mock-video-room">
          <div className="mock-video-header">
            <h2>Video Session (Mock Mode)</h2>
            <p>This is a development mock of the video room.</p>
            <p>Real video functionality requires opening in a full browser window.</p>
          </div>
          <div className="mock-video-content">
            <div className="mock-video-placeholder">
              <div className="mock-camera">
                <div className="mock-camera-icon">📹</div>
                <p>Camera: {userInfo?.name || 'Participant'}</p>
              </div>
              <div className="mock-controls">
                <button className="mock-btn">🎤 Mute</button>
                <button className="mock-btn">📹 Camera</button>
                <button className="mock-btn">📺 Share Screen</button>
                <button className="mock-btn" onClick={onClose}>❌ End Call</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room-wrapper">
      {isLoading && (
        <div className="video-room-loading">
          <div className="loading-spinner"></div>
          <p>Connecting to video session...</p>
          <p className="loading-topic">{sessionInfo?.topic}</p>
        </div>
      )}
      <div
        ref={containerRef}
        className={`video-room-container ${isLoading ? 'hidden' : ''}`}
      />
    </div>
  );
}

export default VideoRoom;

