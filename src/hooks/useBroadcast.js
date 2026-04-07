import { useEffect, useRef } from 'react';

const CHANNEL_NAME = 'culto-presentation';

export function useBroadcastSender() {
  const channelRef = useRef(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    return () => channelRef.current?.close();
  }, []);

  return (msg) => channelRef.current?.postMessage(msg);
}

export function useBroadcastReceiver(onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e) => onMessageRef.current(e.data);
    return () => channel.close();
  }, []);
}
