<script lang="ts">
	import {
		ARCH,
		BODY,
		BODY_INK,
		FLAG,
		POST,
		SLIP_LOWER,
		SLIP_LOWER_PENCIL,
		SLIP_UPPER,
		SLIP_UPPER_PENCIL
	} from '#lib/features/mailbox/mailbox-paths.js';
</script>

<!-- The mailbox, inked with a marker and cut out like a sticker, with the flag
     up and two slips hanging out of its mouth. -->
<svg class="mailbox-drawing" viewBox="-30 8 282 194" aria-hidden="true">
	<g class="mailbox-edge">
		<path d={POST}></path>
		<path d={BODY}></path>
		<path d={ARCH}></path>
		<path d={FLAG}></path>
	</g>
	<path class="mailbox-post" d={POST}></path>
	<path class="mailbox-ink" d={POST}></path>
	<path class="mailbox-body" d={BODY}></path>
	<path class="mailbox-mouth" d={ARCH}></path>
	<path class="mailbox-ink" d={BODY_INK}></path>
	<path class="mailbox-ink" d={ARCH}></path>
	<g class="mailbox-slips">
		<path class="mailbox-paper" d={SLIP_UPPER}></path>
		<path class="mailbox-ink mailbox-ink-thin" d={SLIP_UPPER}></path>
		<path class="mailbox-pencil" d={SLIP_UPPER_PENCIL}></path>
		<path class="mailbox-paper" d={SLIP_LOWER}></path>
		<path class="mailbox-ink mailbox-ink-thin" d={SLIP_LOWER}></path>
		<path class="mailbox-pencil" d={SLIP_LOWER_PENCIL}></path>
	</g>
	<g class="mailbox-flag">
		<path class="mailbox-red" d={FLAG}></path>
		<path class="mailbox-ink" d={FLAG}></path>
		<circle class="mailbox-pivot" cx="202" cy="97" r="6"></circle>
	</g>
</svg>

<style>
	.mailbox-drawing {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(0 2px 3px rgb(40 25 10 / 0.45));
	}

	.mailbox-edge {
		fill: #fbf8f2;
		stroke: #fbf8f2;
		stroke-width: 11px;
		stroke-linejoin: round;
	}

	.mailbox-ink {
		fill: none;
		stroke: #2a2622;
		stroke-width: 5px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.mailbox-ink-thin {
		stroke-width: 3.8px;
	}

	.mailbox-post {
		fill: #c9a46b;
	}

	.mailbox-body {
		fill: #f4efe4;
	}

	.mailbox-mouth {
		fill: #38302a;
	}

	.mailbox-paper {
		fill: #fbf6ea;
	}

	.mailbox-pencil {
		fill: none;
		stroke: #8a8378;
		stroke-width: 2px;
		stroke-linecap: round;
	}

	.mailbox-red {
		fill: #b5473c;
	}

	.mailbox-pivot {
		fill: #2a2622;
	}

	.mailbox-flag {
		transform-origin: 202px 97px;
	}
</style>
