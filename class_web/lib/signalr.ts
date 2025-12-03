 import * as signalR from '@microsoft/signalr';

const _conns: Record<string, signalR.HubConnection> = {};

export function getSignalR(baseUrl: string, path: string = '/hubs/classroom', token?: string) {
  const key = `${baseUrl}|${path}`;
  if (_conns[key]) return _conns[key];
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const conn = new signalR.HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => token || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''),
    })
    .withAutomaticReconnect()
    .build();
  _conns[key] = conn;
  return conn;
}
