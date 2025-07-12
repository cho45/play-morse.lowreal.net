
class Play {
	constructor() {
	}

	play(code, config) {
		if (!this.context) {
			this.context = new AudioContext();
		}
		const source = this.context.createBufferSource();
		source.buffer = this.createToneBuffer(code, config);
		source.connect(this.context.destination);
		source.start(0);
	}

	createToneBuffer(code, config) {
		const speed = 
			config.cpm ? 6000 / config.cpm:
			config.wpm ? 1200 / config.wpm:
				50;
		const unit = this.context.sampleRate * (speed / 1000);
		const tone = this.context.sampleRate / (2 * Math.PI * config.tone);

		const sequence = [];
		let length = 0;
		for (let i = 0, n, len = code.length; i < len; i++) {
			const c = code.charAt(i).toUpperCase();
			if (c === ' ') {
				n = 7 * config.word_spacing * unit;
				length += n;
				sequence.push(-n);
			} else {
				const m = Morse.codes[c];
				for (let j = 0, mlen = m.length; j < mlen; j++) {
					const mc = m.charAt(j);
					if (mc === '.') {
						n = 1 * unit;
						length += n;
						sequence.push(n);
					} else
					if (mc === '-') {
						n = 3 * unit;
						length += n;
						sequence.push(n);
					}
					if (j < mlen - 1) {
						n = 1 * unit;
						length += n;
						sequence.push(-n);
					}
				}
				n = 3 * config.character_spacing * unit;
				length += n;
				sequence.push(-n);
			}
		}
		length = Math.ceil(length);

		const buffer = this.context.createBuffer(1, Math.ceil(length), this.context.sampleRate);
		const data = buffer.getChannelData(0);

		for (let i = 0, x = 0, len = sequence.length; i < len; i++) {
			let s = sequence[i];
			if (s < 0) {
				while (s++ < 0) {
					data[x++] = 0;
				}
			} else {
				for (let p = 0; p < s; p++) {
					data[x++] = Math.sin(p / tone);
				}
				// remove ticking (fade)
				for (let f = 0, e = this.context.sampleRate * 0.004; f < e; f++) {
					data[x - f] = data[x - f] * (f / e); 
				}
			}
		}

		return buffer;
	}
}

// Tab functionality
function initTabs() {
	const tabButtons = document.querySelectorAll('[role="tab"]');
	const tabPanels = document.querySelectorAll('[role="tabpanel"]');

	function showTab(targetId) {
		// Hide all panels
		tabPanels.forEach(panel => {
			panel.classList.remove('active');
			panel.classList.add('hidden');
		});

		// Update all buttons
		tabButtons.forEach(button => {
			button.setAttribute('aria-selected', 'false');
		});

		// Show target panel
		const targetPanel = document.getElementById(targetId);
		if (targetPanel) {
			targetPanel.classList.add('active');
			targetPanel.classList.remove('hidden');
		}

		// Update target button
		const targetButton = document.getElementById(targetId + '-tab');
		if (targetButton) {
			targetButton.setAttribute('aria-selected', 'true');
		}
	}

	// Add click handlers
	tabButtons.forEach(button => {
		button.addEventListener('click', (e) => {
			e.preventDefault();
			const targetId = button.getAttribute('aria-controls');
			if (targetId) {
				showTab(targetId);
			}
		});

	});

	return { showTab };
}



document.addEventListener('DOMContentLoaded', function () {
	if (typeof AudioContext === 'undefined') {
		const noscriptContent = document.querySelector('noscript');
		if (noscriptContent) {
			const div = document.createElement('div');
			div.innerHTML = noscriptContent.textContent;
			noscriptContent.replaceWith(div);
		}
		return;
	}

	// Render main template
	const mainTemplate = document.getElementById('main');
	if (mainTemplate) {
		const mainContent = extended('main', {});
		mainTemplate.outerHTML = mainContent;
	}


	// Initialize tabs
	const { showTab } = initTabs();


	const opts = {
		wpm: +localStorage['chars-wpm']   || 20,
		tone : +localStorage['chars-tone'] || 600, 
		word_spacing : 1,
		character_spacing: 1
	};

	// Handle URL parameters
	const params = new URLSearchParams(location.hash.substring(1));
	if (params.has('text')) {
		showTab('text');
		const textInput = document.getElementById('text-input');
		if (textInput) {
			textInput.value = params.get('text') || '';
		}
	}
	if (params.has('wpm')) {
		opts.wpm = +params.get('wpm') || 20;
	}

	// Prevent options form submission
	const optionsForm = document.querySelector('#options form');
	if (optionsForm) {
		optionsForm.addEventListener('submit', function (e) {
			e.preventDefault();
			return false;
		});
	}

	// Handle options inputs
	const optionInputs = document.querySelectorAll('#options input');
	optionInputs.forEach(input => {
		// Set initial values
		if (opts[input.name] !== undefined) {
			input.value = opts[input.name];
		}

		// Add event listeners
		['keyup', 'change'].forEach(eventType => {
			input.addEventListener(eventType, function () {
				const name = this.name;
				const value = +this.value;
				opts[name] = value;
				localStorage['chars-' + name] = this.value;
			});
		});
	});

	const play = new Play();

	function handleCharacterButtonEvent(e) {
		const button = e.target.matches('button[data-char]') ? e.target : e.target.closest('button[data-char]');
		if (button) {
			if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
				return;
			}
			if (e.type === 'keydown') {
				e.preventDefault();
			}
			const char = button.getAttribute('data-char');
			if (char) {
				play.play(char, opts);
			}
		}
	}

	document.addEventListener('click', handleCharacterButtonEvent);
	document.addEventListener('keydown', handleCharacterButtonEvent);

	// Handle text form submission
	const playTextForm = document.getElementById('play-text');
	if (playTextForm) {
		playTextForm.addEventListener('submit', function (e) {
			e.preventDefault();
			try {
				const textInput = this.querySelector('#text-input');
				if (textInput) {
					const text = textInput.value.replace(/\s+/g, ' ').trim();
					if (text) {
						play.play(text, opts);
						const params = new URLSearchParams(location.hash.substring(1));
						params.set('text', text);
						location.hash = '#' + params.toString();
					} else {
						textInput.focus();
					}
				}
			} catch (error) { 
				const errorMessage = `Error playing Morse code: ${error.message}`;
				alert(errorMessage);
			}
			return false;
		});
	}
});
