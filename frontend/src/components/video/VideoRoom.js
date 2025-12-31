import { useEffect, useRef, useState, useCallback } from 'react';
import './VideoRoom.css';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load JaaS external API script
  const loadJitsiScript = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://8x8.vc/${appId}/external_api.js`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load JaaS script'));
      document.head.appendChild(script);
    });
  }, [appId]);

  // Initialize the Jitsi iframe
  const initializeJitsi = useCallback(async () => {
    if (!containerRef.current || !jwt || !roomName) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await loadJitsiScript();

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

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      // Set up event listeners
      apiRef.current.addListener('videoConferenceJoined', () => {
        console.log('[VideoRoom] Conference joined');
        setIsLoading(false);
      });

      apiRef.current.addListener('videoConferenceLeft', () => {
        console.log('[VideoRoom] Conference left');
        if (onClose) {
          onClose();
        }
      });

      apiRef.current.addListener('participantJoined', (participant) => {
        console.log('[VideoRoom] Participant joined:', participant);
        if (onParticipantJoined) {
          onParticipantJoined(participant);
        }
      });

      apiRef.current.addListener('readyToClose', () => {
        console.log('[VideoRoom] Ready to close');
        if (onClose) {
          onClose();
        }
      });

      // Also listen for when the iframe is loaded (fallback for loading state)
      apiRef.current.addListener('browserSupport', () => {
        console.log('[VideoRoom] Browser support check passed');
      });

      // Handle errors
      apiRef.current.addListener('errorOccurred', (error) => {
        console.error('[VideoRoom] Error occurred:', error);
        setError(error?.message || 'An error occurred in the video session');
        setIsLoading(false);
      });

      // Timeout fallback - if still loading after 15 seconds, something's wrong
      setTimeout(() => {
        if (isLoading && apiRef.current) {
          console.log('[VideoRoom] Timeout - hiding loading overlay');
          setIsLoading(false);
        }
      }, 15000);

    } catch (err) {
      console.error('Failed to initialize video room:', err);
      setError(err.message || 'Failed to start video session');
      setIsLoading(false);
    }
  }, [jwt, roomName, domain, userInfo, sessionInfo, onClose, onParticipantJoined, loadJitsiScript]);

  // Initialize on mount
  useEffect(() => {
    initializeJitsi();

    // Cleanup on unmount
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [initializeJitsi]);

  if (error) {
    return (
      <div className="video-room-error">
        <div className="error-content">
          <span className="error-icon">⚠️</span>
          <h3>Unable to Start Video</h3>
          <p>{error}</p>
          <button onClick={onClose} className="error-close-btn">
            Close
          </button>
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

