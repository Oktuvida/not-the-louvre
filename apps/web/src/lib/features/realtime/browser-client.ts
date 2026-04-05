import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const browserRealtimeClients = new Map<string, SupabaseClient>();

const realtimeAuthOptions = {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false
	}
} as const;

const toClientKey = (url: string, anonKey: string) => `${url}::${anonKey}`;

export const getBrowserRealtimeClient = (url: string, anonKey: string) => {
	const clientKey = toClientKey(url, anonKey);
	const existingClient = browserRealtimeClients.get(clientKey);

	if (existingClient) {
		return existingClient;
	}

	const client = createClient(url, anonKey, realtimeAuthOptions);
	browserRealtimeClients.set(clientKey, client);
	return client;
};

export const resetBrowserRealtimeClientCache = () => {
	browserRealtimeClients.clear();
};
