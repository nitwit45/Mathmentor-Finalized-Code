import { useEffect, useRef, useState, useCallback } from 'react';
import { HiExclamation } from 'react-icons/hi';
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
  const initializingRef = useRef(false);
  const loadingTimeoutRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Keep callback refs up to date
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onParticipantJoinedRef.current = onParticipantJoined;
  }, [onParticipantJoined]);

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
    // Guard against double initialization (React StrictMode)
    if (initializingRef.current) {
      console.log('[VideoRoom] Already initializing, skipping...');
      return;
    }

    if (!containerRef.current || !jwt || !roomName) {
      return;
    }

    initializingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      await loadJitsiScript();

      // Clean up any existing instance
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (err) {
          console.warn('[VideoRoom] Error disposing previous instance:', err);
        }
        apiRef.current = null;
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

      // Log the configuration for debugging
      console.log('[VideoRoom] Initializing with config:', {
        domain,
        roomName,
        jwtLength: jwt?.length,
        jwtPreview: jwt?.substring(0, 50) + '...',
        appId,
      });

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      // Helper to clear loading state
      const clearLoadingState = () => {
        setIsLoading(false);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      };

      // Set up event listeners
      // Primary event - fires when local user joins conference
      apiRef.current.addListener('videoConferenceJoined', (data) => {
        console.log('[VideoRoom] Conference joined:', data);
        clearLoadingState();
      });

      // Fallback event - also check when participants join (including local user)
      apiRef.current.addListener('participantJoined', (participant) => {
        console.log('[VideoRoom] Participant joined:', participant);
        
        // Clear loading when any participant joins (meeting is active)
        setIsLoading((currentLoading) => {
          if (currentLoading) {
            console.log('[VideoRoom] Clearing loading via participantJoined');
            clearLoadingState();
            return false;
          }
          return currentLoading;
        });
        
        // Notify parent component
        if (onParticipantJoinedRef.current) {
          onParticipantJoinedRef.current(participant);
        }
      });

      // Additional fallback - iframe ready event
      apiRef.current.addListener('videoConferenceReady', () => {
        console.log('[VideoRoom] Video conference ready');
        clearLoadingState();
      });

      // Cleanup events
      apiRef.current.addListener('videoConferenceLeft', () => {
        console.log('[VideoRoom] Conference left');
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      });

      apiRef.current.addListener('readyToClose', () => {
        console.log('[VideoRoom] Ready to close');
        if (onCloseRef.current) {
          onCloseRef.current();
        }
      });

      // Error and authentication listeners
      apiRef.current.addListener('passwordRequired', () => {
        console.error('[VideoRoom] Password required - JWT may be invalid');
        setError('Authentication failed. Please try again.');
        clearLoadingState();
      });

      apiRef.current.addListener('errorOccurred', (errorEvent) => {
        console.error('[VideoRoom] Error occurred:', errorEvent);
        setError(errorEvent?.message || 'An error occurred in the video session');
        clearLoadingState();
      });

      apiRef.current.addListener('connectionFailed', (errorEvent) => {
        console.error('[VideoRoom] Connection failed:', errorEvent);
        setError('Connection failed. Please check your internet and try again.');
        clearLoadingState();
      });

      apiRef.current.addListener('conferenceError', (errorEvent) => {
        console.error('[VideoRoom] Conference error:', errorEvent);
        setError('Unable to join conference. Please try again.');
        clearLoadingState();
      });

      // Debug listeners
      apiRef.current.addListener('suspendDetected', () => {
        console.log('[VideoRoom] Suspend detected');
      });

      apiRef.current.addListener('browserSupport', () => {
        console.log('[VideoRoom] Browser support check passed');
      });

      // Timeout fallback - if still loading after 15 seconds, force clear
      // Use functional state update to avoid stale closure
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[VideoRoom] Timeout reached, checking loading state...');
        setIsLoading((currentLoading) => {
          if (currentLoading && apiRef.current) {
            console.log('[VideoRoom] Timeout - forcing loading state to false');
            return false;
          }
          return currentLoading;
        });
      }, 15000);

    } catch (err) {
      console.error('[VideoRoom] Failed to initialize video room:', err);
      setError(err.message || 'Failed to start video session');
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [jwt, roomName, domain, sessionInfo?.topic, loadJitsiScript]);

  // Initialize on mount
  useEffect(() => {
    initializeJitsi();

    // Cleanup on unmount
    return () => {
      console.log('[VideoRoom] Cleaning up...');
      
      // Clear loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Dispose Jitsi API instance
      if (apiRef.current) {
        try {
          apiRef.current.dispose();
        } catch (err) {
          console.warn('[VideoRoom] Error during cleanup:', err);
        }
        apiRef.current = null;
      }

      // Reset initialization flag
      initializingRef.current = false;
    };
  }, [initializeJitsi]);

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

