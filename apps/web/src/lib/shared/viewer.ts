// The product role vocabulary, shared by the drizzle enum, the server session
// types and every component that renders a viewer. Keeping the order in sync
// with `app.user_role` matters: drizzle-kit diffs enum member order.
export const PRODUCT_ROLES = ['user', 'moderator', 'admin'] as const;

export type ProductRole = (typeof PRODUCT_ROLES)[number];

// The shape the page loaders hand to the gallery components: enough to decide
// what a visitor may see and do, and nothing else.
export type Viewer = {
	id: string;
	role: ProductRole;
};
