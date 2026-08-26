import type { SupabaseClient } from '@supabase/supabase-js';

const browserRealtimeClients = new Map<string, Promise<SupabaseClient>>();

const realtimeAuthOptions = {
	auth: {
		autoRefreshToken: false,
		detectSessionInUrl: false,
		persistSession: false
	}
} as const;

const toClientKey = (url: string, anonKey: string) => `${url}::${anonKey}`;

// supabase-js loads on demand so pages that never start a realtime
// subscription (anonymous gallery visits) never download it.
const createBrowserRealtimeClient = async (url: string, anonKey: string) => {
	const { createClient } = await import('@supabase/supabase-js');

	return createClient(url, anonKey, realtimeAuthOptions);
};

export const getBrowserRealtimeClient = (url: string, anonKey: string): Promise<SupabaseClient> => {
	const clientKey = toClientKey(url, anonKey);
	const existingClient = browserRealtimeClients.get(clientKey);

	if (existingClient) {
		return existingClient;
	}

	const client = createBrowserRealtimeClient(url, anonKey).catch((error) => {
		browserRealtimeClients.delete(clientKey);
		throw error;
	});

	browserRealtimeClients.set(clientKey, client);
	return client;
};

export const resetBrowserRealtimeClientCache = () => {
	browserRealtimeClients.clear();
};
