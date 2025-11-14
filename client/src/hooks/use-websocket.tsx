import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  tenantId?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Get JWT token from localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('[WebSocket] No authentication token found, skipping connection');
      setAuthError('Authentication required');
      return;
    }

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // Add JWT token as query parameter
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
        
        console.log('[WebSocket] Connecting with authentication...');
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          setIsConnected(true);
          setAuthError(null);
          console.log('[WebSocket] Connected successfully');
        };

        ws.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle connection established message
            if (message.type === 'connection_established') {
              console.log('[WebSocket] Authentication confirmed:', message.data);
            }
            
            // Handle authentication errors
            if (message.type === 'error') {
              console.error('[WebSocket] Server error:', message.data);
              setAuthError(message.data.message);
            }
            
            setLastMessage(message);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        ws.current.onclose = (event) => {
          setIsConnected(false);
          
          // Handle authentication errors (code 1008)
          if (event.code === 1008) {
            console.error('[WebSocket] Authentication failed:', event.reason);
            setAuthError(event.reason || 'Authentication failed');
            // Don't reconnect on auth failure
            return;
          }
          
          console.log('[WebSocket] Connection closed:', event.reason);
          
          // Attempt to reconnect after 5 seconds for non-auth failures
          if (event.code !== 1000) { // 1000 is normal closure
            console.log('[WebSocket] Will attempt to reconnect in 5 seconds...');
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[WebSocket] Reconnecting...');
              connectWebSocket();
            }, 5000);
          }
        };

        ws.current.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
        };
      } catch (error) {
        console.error('[WebSocket] Failed to create connection:', error);
        setAuthError('Failed to establish WebSocket connection');
      }
    };

    connectWebSocket();

    return () => {
      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket connection
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message - connection not open');
    }
  };

  return {
    isConnected,
    lastMessage,
    sendMessage,
    authError
  };
}
