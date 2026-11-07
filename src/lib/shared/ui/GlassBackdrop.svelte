<!-- What the glass refracts: slow liquid color behind the app, and the lens used by Chromium. -->
<div class="glass-wallpaper" aria-hidden="true" data-testid="glass-wallpaper">
	<span></span>
	<span></span>
	<span></span>
	<span></span>
</div>
<svg class="absolute size-0" aria-hidden="true">
	<filter
		id="spacy-liquid"
		x="0"
		y="0"
		width="100%"
		height="100%"
		color-interpolation-filters="sRGB"
	>
		<feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="7" />
		<feDisplacementMap in="SourceGraphic" scale="34" xChannelSelector="R" yChannelSelector="G" />
	</filter>
</svg>
