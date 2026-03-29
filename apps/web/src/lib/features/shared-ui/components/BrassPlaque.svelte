<script lang="ts">
	const SIZES = {
		large: 'px-8 py-5 text-3xl md:text-4xl',
		medium: 'px-6 py-4 text-2xl',
		small: 'px-4 py-3 text-lg'
	} as const;

	let {
		className = '',
		size = 'medium',
		text
	}: {
		className?: string;
		size?: 'small' | 'medium' | 'large';
		text: string;
	} = $props();
</script>

<div
	class={`relative inline-flex items-center justify-center rounded-[1.4rem] border-[4px] border-[#4d351c] ${SIZES[size]} ${className}`}
	style="background:linear-gradient(145deg,#f6d98f 0%,#d2a34f 26%,#a66f2c 52%,#f1d28f 100%); box-shadow: 0 1rem 2rem rgba(45,36,32,0.24), inset 0 0.2rem 0.5rem rgba(255,255,255,0.35), inset 0 -0.25rem 0.5rem rgba(77,53,28,0.25);"
>
	<div
		class="pointer-events-none absolute top-3 left-3 h-3 w-3 rounded-full border border-[#5f4529] bg-[radial-gradient(circle_at_35%_35%,#fff5d6,#8e6632)]"
	></div>
	<div
		class="pointer-events-none absolute top-3 right-3 h-3 w-3 rounded-full border border-[#5f4529] bg-[radial-gradient(circle_at_35%_35%,#fff5d6,#8e6632)]"
	></div>
	<div
		class="pointer-events-none absolute bottom-3 left-3 h-3 w-3 rounded-full border border-[#5f4529] bg-[radial-gradient(circle_at_35%_35%,#fff5d6,#8e6632)]"
	></div>
	<div
		class="pointer-events-none absolute right-3 bottom-3 h-3 w-3 rounded-full border border-[#5f4529] bg-[radial-gradient(circle_at_35%_35%,#fff5d6,#8e6632)]"
	></div>

	<span
		class="font-display text-center font-black tracking-[0.16em] text-[#4f351a] uppercase"
		style="text-shadow: 0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(77,53,28,0.2);"
	>
		{text}
	</span>
</div>
