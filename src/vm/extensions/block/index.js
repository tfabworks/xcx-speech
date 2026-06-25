import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
import blockIcon from './block-icon.png';

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.default;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'voice';

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://asondemita.github.io/xcx-voice/dist/voice.mjs';

/**
 * Get the Web Speech API SpeechRecognition constructor if available.
 * @returns {?Function} - SpeechRecognition constructor or null
 */
const getSpeechRecognition = () =>
    (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
    null;

/**
 * Character voice presets for the speak block. gender selects the Polly voice
 * for the locale; playback is an HTMLAudioElement playbackRate (changes pitch
 * and speed together, so it works on every device).
 * @type {object}
 */
const VOICE_PRESETS = {
    normal: {gender: 'female', playback: 1.0},
    mouse: {gender: 'female', playback: 1.6},
    robot: {gender: 'male', playback: 0.88},
    ghost: {gender: 'male', playback: 0.6}
};

/**
 * Scratch's text-to-speech synthesis service (Amazon Polly, CORS-open).
 * @type {string}
 */
const SYNTH_URL = 'https://synthesis-service.scratch.mit.edu/synth';

/**
 * Convert a BCP-47 tag to a locale accepted by the synthesis service.
 * @param {string} tag - BCP-47 tag (e.g. 'ja-JP').
 * @returns {string} - a synthesis-service locale.
 */
const toSynthLocale = tag => {
    const lower = String(tag).toLowerCase();
    if (lower.indexOf('zh') === 0) return 'cmn-CN';
    if (lower.indexOf('ja') === 0) return 'ja-JP';
    if (lower.indexOf('ko') === 0) return 'ko-KR';
    if (lower.indexOf('en') === 0) return 'en-US';
    return tag;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Reject a recognition result whose reported confidence is positive but below
 * this value. (Some engines report 0 = "unknown"; those are not rejected here.)
 * @type {number}
 */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Minimum number of characters required for a result to be accepted.
 * @type {number}
 */
const MIN_LENGTH = 1;

/**
 * Matches at least one "meaningful" character (latin, digit, kana, kanji or
 * hangul). A result with none of these (empty / symbols only) is treated as
 * noise.
 * @type {RegExp}
 */
const MEANINGFUL_CHAR = /[A-Za-z0-9぀-ヿ㐀-䶿一-鿿가-힯]/;

/**
 * Endpoint for the free MyMemory translation API (CORS-open, no API key).
 * @type {string}
 */
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

/**
 * Optional account email for MyMemory. Leave empty for anonymous use; set it
 * to raise the daily translation quota (per IP).
 * @type {string}
 */
const MYMEMORY_EMAIL = 'asondemita@gmail.com';

/**
 * Convert a BCP-47 language tag to a MyMemory language code.
 * @param {string} tag - BCP-47 tag (e.g. 'ja-JP').
 * @returns {string} - MyMemory code (e.g. 'ja', 'zh-CN').
 */
const toMyMemoryLang = tag => {
    const lower = String(tag).toLowerCase();
    if (lower.indexOf('zh') === 0) return 'zh-CN';
    return lower.split('-')[0];
};

/**
 * Guess the source language of a text (tuned for Japanese <-> English).
 * @param {string} text - the text to inspect.
 * @returns {string} - a MyMemory language code.
 */
const detectSourceLang = text => {
    if (/[぀-ヿ]/.test(text)) return 'ja'; // kana
    if (/[가-힯]/.test(text)) return 'ko'; // hangul
    if (/[㐀-䶿一-鿿]/.test(text)) return 'ja'; // kanji -> assume Japanese
    return 'en';
};

/**
 * Scratch 3.0 blocks for voice: speech recognition (listen) and
 * speech synthesis (speak) with character voices, using the Web Speech API.
 */
class ExtensionBlocks {
    /**
     * A translation object which is used in this class.
     * @param {FormatObject} formatter - translation object
     */
    static set formatMessage (formatter) {
        formatMessage = formatter;
        if (formatMessage) setupTranslations();
    }

    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'voice.name',
            default: 'Voice',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for Voice.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }

        /**
         * The latest recognized speech.
         * @type {string}
         */
        this.latestSpeech = '';

        /**
         * The reason of the latest recognition error (the value of
         * SpeechRecognitionErrorEvent.error), or '' when there was no error.
         * @type {string}
         */
        this.lastError = '';

        /**
         * The language used for speech recognition (BCP-47 tag).
         * @type {string}
         */
        this.recognitionLanguage = 'ja-JP';

        /**
         * The language used for speech synthesis (BCP-47 tag).
         * @type {string}
         */
        this.speakLanguage = 'ja-JP';

        /**
         * When true, the speak block translates the text from the recognition
         * language into the speak language before speaking.
         * @type {boolean}
         */
        this.autoTranslate = false;

        /**
         * The recognition instance currently running, if any.
         * @type {?SpeechRecognition}
         */
        this.recognition = null;

        /**
         * The current character voice preset key.
         * @type {string}
         */
        this.voicePreset = 'normal';

        /**
         * Multiplier applied to the preset rate (1 = preset default).
         * @type {number}
         */
        this.rateScale = 1;

        /**
         * Multiplier applied to the preset pitch (1 = preset default).
         * @type {number}
         */
        this.pitchScale = 1;

        /**
         * The HTMLAudioElement currently playing a synthesized voice, if any.
         * @type {?HTMLAudioElement}
         */
        this.currentAudio = null;

        if (this.runtime && this.runtime.on) {
            this.runtime.on('PROJECT_STOP_ALL', this.stopAll.bind(this));
        }
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: ExtensionBlocks.EXTENSION_ID,
            name: ExtensionBlocks.EXTENSION_NAME,
            extensionURL: ExtensionBlocks.extensionURL,
            blockIconURI: blockIcon,
            showStatusButton: false,
            blocks: [
                {
                    opcode: 'listenAndWait',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.listenAndWait',
                        default: 'listen and wait',
                        description: 'start listening and wait until a result is received'
                    }),
                    func: 'listenAndWait',
                    arguments: {}
                },
                {
                    opcode: 'getSpeech',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'voice.getSpeech',
                        default: 'speech',
                        description: 'the latest recognized speech'
                    }),
                    func: 'getSpeech',
                    arguments: {}
                },
                {
                    opcode: 'speechContains',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'voice.speechContains',
                        default: 'speech contains [WORD]?',
                        description: 'whether the latest speech contains the word'
                    }),
                    func: 'speechContains',
                    arguments: {
                        WORD: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'voice.defaultWord',
                                default: 'hello',
                                description: 'default value of the word argument'
                            })
                        }
                    }
                },
                '---',
                {
                    opcode: 'speak',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.speak',
                        default: 'speak [TEXT]',
                        description: 'speak the text aloud'
                    }),
                    func: 'speak',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'voice.defaultSpeak',
                                default: 'hello',
                                description: 'default value of the speak argument'
                            })
                        }
                    }
                },
                {
                    opcode: 'setVoicePreset',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setVoicePreset',
                        default: 'set voice to [PRESET]',
                        description: 'set the character voice preset'
                    }),
                    func: 'setVoicePreset',
                    arguments: {
                        PRESET: {
                            type: ArgumentType.STRING,
                            menu: 'voicePresetMenu',
                            defaultValue: 'normal'
                        }
                    }
                },
                {
                    opcode: 'setRate',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setRate',
                        default: 'set speaking speed to [RATE]x',
                        description: 'set the speaking speed multiplier'
                    }),
                    func: 'setRate',
                    arguments: {
                        RATE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'setPitch',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setPitch',
                        default: 'set voice pitch to [PITCH]x',
                        description: 'set the voice pitch multiplier'
                    }),
                    func: 'setPitch',
                    arguments: {
                        PITCH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                '---',
                {
                    opcode: 'translate',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'voice.translate',
                        default: 'translate [TEXT] into [LANGUAGE]',
                        description: 'translate the text into the language'
                    }),
                    func: 'translate',
                    arguments: {
                        TEXT: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'voice.defaultTranslate',
                                default: 'hello',
                                description: 'default value of the translate argument'
                            })
                        },
                        LANGUAGE: {
                            type: ArgumentType.STRING,
                            menu: 'languageMenu',
                            defaultValue: 'en-US'
                        }
                    }
                },
                '---',
                {
                    opcode: 'setRecognitionLanguage',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setRecognitionLanguage',
                        default: 'set listening language to [LANGUAGE]',
                        description: 'set the language used for recognition'
                    }),
                    func: 'setRecognitionLanguage',
                    arguments: {
                        LANGUAGE: {
                            type: ArgumentType.STRING,
                            menu: 'languageMenu',
                            defaultValue: 'ja-JP'
                        }
                    }
                },
                {
                    opcode: 'setSpeakLanguage',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setSpeakLanguage',
                        default: 'set speaking language to [LANGUAGE]',
                        description: 'set the language used for synthesis'
                    }),
                    func: 'setSpeakLanguage',
                    arguments: {
                        LANGUAGE: {
                            type: ArgumentType.STRING,
                            menu: 'languageMenu',
                            defaultValue: 'ja-JP'
                        }
                    }
                },
                {
                    opcode: 'setAutoTranslate',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'voice.setAutoTranslate',
                        default: 'translate when speaking [STATE]',
                        description: 'turn translation on speak on or off'
                    }),
                    func: 'setAutoTranslate',
                    arguments: {
                        STATE: {
                            type: ArgumentType.STRING,
                            menu: 'onOffMenu',
                            defaultValue: 'off'
                        }
                    }
                },
                {
                    opcode: 'isSupported',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'voice.isSupported',
                        default: 'speech recognition available?',
                        description: 'whether the Web Speech API recognition is available'
                    }),
                    func: 'isSupported',
                    arguments: {}
                },
                {
                    opcode: 'isTranslateAvailable',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'voice.isTranslateAvailable',
                        default: 'translation available?',
                        description: 'whether translation is usable in this environment'
                    }),
                    func: 'isTranslateAvailable',
                    arguments: {}
                },
                {
                    opcode: 'isSpeakAvailable',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'voice.isSpeakAvailable',
                        default: 'speaking available?',
                        description: 'whether the speak block can produce sound'
                    }),
                    func: 'isSpeakAvailable',
                    arguments: {}
                }
            ],
            menus: {
                languageMenu: {
                    acceptReporters: true,
                    items: 'getLanguageMenu'
                },
                voicePresetMenu: {
                    acceptReporters: true,
                    items: 'getVoicePresetMenu'
                },
                onOffMenu: {
                    acceptReporters: true,
                    items: 'getOnOffMenu'
                }
            }
        };
    }

    /**
     * Build the on/off menu.
     * @returns {Array<object>} - menu items
     */
    getOnOffMenu () {
        return [
            {
                text: formatMessage({id: 'voice.on', default: 'on', description: 'on'}),
                value: 'on'
            },
            {
                text: formatMessage({id: 'voice.off', default: 'off', description: 'off'}),
                value: 'off'
            }
        ];
    }

    /**
     * Build the language menu.
     * @returns {Array<object>} - menu items
     */
    getLanguageMenu () {
        return [
            {
                text: formatMessage({
                    id: 'voice.language.ja',
                    default: 'Japanese',
                    description: 'Japanese language menu item'
                }),
                value: 'ja-JP'
            },
            {
                text: formatMessage({
                    id: 'voice.language.en',
                    default: 'English',
                    description: 'English language menu item'
                }),
                value: 'en-US'
            },
            {
                text: formatMessage({
                    id: 'voice.language.zh',
                    default: 'Chinese',
                    description: 'Chinese language menu item'
                }),
                value: 'zh-CN'
            },
            {
                text: formatMessage({
                    id: 'voice.language.ko',
                    default: 'Korean',
                    description: 'Korean language menu item'
                }),
                value: 'ko-KR'
            }
        ];
    }

    /**
     * Build the character voice preset menu.
     * @returns {Array<object>} - menu items
     */
    getVoicePresetMenu () {
        return [
            {
                text: formatMessage({id: 'voice.preset.normal', default: 'normal', description: 'normal voice'}),
                value: 'normal'
            },
            {
                text: formatMessage({id: 'voice.preset.mouse', default: 'mouse', description: 'mouse voice'}),
                value: 'mouse'
            },
            {
                text: formatMessage({id: 'voice.preset.robot', default: 'robot', description: 'robot voice'}),
                value: 'robot'
            },
            {
                text: formatMessage({id: 'voice.preset.ghost', default: 'ghost', description: 'ghost voice'}),
                value: 'ghost'
            }
        ];
    }

    /**
     * Set the language used for speech recognition.
     * @param {object} args - the block's arguments.
     * @param {string} args.LANGUAGE - BCP-47 language tag.
     */
    setRecognitionLanguage (args) {
        this.recognitionLanguage = Cast.toString(args.LANGUAGE);
    }

    /**
     * Set the language used for speech synthesis.
     * @param {object} args - the block's arguments.
     * @param {string} args.LANGUAGE - BCP-47 language tag.
     */
    setSpeakLanguage (args) {
        this.speakLanguage = Cast.toString(args.LANGUAGE);
    }

    /**
     * Turn auto translation on or off.
     * @param {object} args - the block's arguments.
     * @param {string} args.STATE - 'on' or 'off'.
     */
    setAutoTranslate (args) {
        this.autoTranslate = (Cast.toString(args.STATE).toLowerCase() === 'on');
    }

    /**
     * Request a translation from the MyMemory API.
     * @param {string} text - text to translate (non-empty).
     * @param {string} sourceCode - MyMemory source language code.
     * @param {string} targetCode - MyMemory target language code.
     * @returns {Promise<string>} - the translated text ('' on failure).
     */
    requestTranslation (text, sourceCode, targetCode) {
        if (typeof fetch === 'undefined') return Promise.resolve('');
        let url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}` +
            `&langpair=${encodeURIComponent(`${sourceCode}|${targetCode}`)}`;
        if (MYMEMORY_EMAIL) {
            url += `&de=${encodeURIComponent(MYMEMORY_EMAIL)}`;
        }
        return fetch(url)
            .then(response => response.json())
            .then(json => {
                const status = json && Number(json.responseStatus);
                const result = json && json.responseData && json.responseData.translatedText;
                if (!result || status !== 200 || /MYMEMORY WARNING/i.test(result)) {
                    return '';
                }
                return result;
            })
            .catch(() => '');
    }

    /**
     * Translate text into the given language using the MyMemory API.
     * The source language is detected automatically (tuned for ja <-> en).
     * @param {object} args - the block's arguments.
     * @param {string} args.TEXT - text to translate.
     * @param {string} args.LANGUAGE - target language (BCP-47 tag).
     * @returns {Promise<string>|string} - the translated text ('' on failure).
     */
    translate (args) {
        const text = Cast.toString(args.TEXT).trim();
        if (text === '') return '';
        const target = toMyMemoryLang(args.LANGUAGE);
        const source = detectSourceLang(text);
        if (source === target) return text;
        return this.requestTranslation(text, source, target);
    }

    /**
     * @returns {boolean} - whether translation can be used now (fetch is
     *   available and the device is not known to be offline).
     */
    isTranslateAvailable () {
        if (typeof fetch === 'undefined') return false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
        return true;
    }

    /**
     * @returns {boolean} - whether the speak block can produce sound now (it
     *   uses Scratch's online synthesis service, so this needs fetch + Audio
     *   and a network connection).
     */
    isSpeakAvailable () {
        return typeof fetch !== 'undefined' &&
            typeof Audio !== 'undefined' &&
            typeof URL !== 'undefined' &&
            typeof URL.createObjectURL === 'function' &&
            (typeof navigator === 'undefined' || navigator.onLine !== false);
    }

    // ---- Speech synthesis (speak) ----

    /**
     * Set the character voice preset.
     * @param {object} args - the block's arguments.
     * @param {string} args.PRESET - preset key.
     */
    setVoicePreset (args) {
        const preset = Cast.toString(args.PRESET);
        this.voicePreset = VOICE_PRESETS[preset] ? preset : 'normal';
    }

    /**
     * Set the speaking speed multiplier (applied on top of the preset).
     * @param {object} args - the block's arguments.
     * @param {number} args.RATE - speed multiplier.
     */
    setRate (args) {
        this.rateScale = clamp(Cast.toNumber(args.RATE), 0.1, 10);
    }

    /**
     * Set the voice pitch multiplier (applied on top of the preset).
     * @param {object} args - the block's arguments.
     * @param {number} args.PITCH - pitch multiplier.
     */
    setPitch (args) {
        this.pitchScale = clamp(Cast.toNumber(args.PITCH), 0, 5);
    }

    /**
     * Speak the given text aloud and resolve when finished. When auto
     * translation is on, the text is first translated from the recognition
     * language into the speak language.
     * @param {object} args - the block's arguments.
     * @param {string} args.TEXT - text to speak.
     * @returns {Promise} - resolves when speaking finishes.
     */
    speak (args) {
        const text = Cast.toString(args.TEXT);
        if (!this.autoTranslate) {
            return this.speakText(text);
        }
        const source = toMyMemoryLang(this.recognitionLanguage);
        const target = toMyMemoryLang(this.speakLanguage);
        const trimmed = text.trim();
        if (trimmed === '' || source === target) {
            return this.speakText(text);
        }
        return this.requestTranslation(trimmed, source, target)
            .then(translated => this.speakText(translated || text));
    }

    /**
     * Speak the given text aloud (in the speak language) and resolve when done.
     * Always uses Scratch's high-quality synthesis service (Amazon Polly); when
     * it is unavailable (offline or unsupported) nothing is spoken.
     * @param {string} text - text to speak.
     * @returns {Promise} - resolves when speaking finishes (or is skipped).
     */
    speakText (text) {
        if (!this.isSpeakAvailable()) {
            return Promise.resolve();
        }
        return this.speakWithService(text).catch(() => undefined);
    }

    /**
     * Speak via Scratch's synthesis service (Amazon Polly). The character
     * presets adjust the HTMLAudioElement playbackRate, which changes pitch and
     * speed together (so it works on every device, unlike Web Speech pitch).
     * @param {string} text - text to speak.
     * @returns {Promise} - resolves when finished; rejects on any failure.
     */
    speakWithService (text) {
        this.stopSpeaking();
        const preset = VOICE_PRESETS[this.voicePreset] || VOICE_PRESETS.normal;
        const playbackRate = clamp(preset.playback * this.rateScale * this.pitchScale, 0.3, 4);
        const locale = toSynthLocale(this.speakLanguage);
        const url = `${SYNTH_URL}?locale=${encodeURIComponent(locale)}` +
            `&gender=${encodeURIComponent(preset.gender)}` +
            `&text=${encodeURIComponent(text)}`;
        return fetch(url)
            .then(response => {
                const type = response.headers.get('content-type') || '';
                if (!response.ok || type.indexOf('audio') === -1) {
                    throw new Error(`synthesis failed: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => new Promise((resolve, reject) => {
                const objectUrl = URL.createObjectURL(blob);
                const audio = new Audio();
                this.currentAudio = audio;
                // Let playbackRate change the pitch (do not preserve pitch).
                audio.preservesPitch = false;
                audio.mozPreservesPitch = false;
                audio.webkitPreservesPitch = false;
                audio.src = objectUrl;
                audio.playbackRate = playbackRate;
                const cleanup = () => {
                    URL.revokeObjectURL(objectUrl);
                    if (this.currentAudio === audio) this.currentAudio = null;
                };
                audio.onended = () => {
                    cleanup();
                    resolve();
                };
                audio.onerror = () => {
                    cleanup();
                    reject(new Error('audio playback error'));
                };
                const playPromise = audio.play();
                if (playPromise && playPromise.catch) {
                    playPromise.catch(err => {
                        cleanup();
                        reject(err);
                    });
                }
            }));
    }

    /**
     * Stop the speech that is currently playing.
     */
    stopSpeaking () {
        if (this.currentAudio) {
            try {
                this.currentAudio.onended = null;
                this.currentAudio.onerror = null;
                this.currentAudio.pause();
            } catch (e) {
                // ignore
            }
            this.currentAudio = null;
        }
    }

    // ---- Speech recognition (listen) ----

    /**
     * Stop any running recognition.
     */
    stopListening () {
        if (this.recognition) {
            try {
                this.recognition.onresult = null;
                this.recognition.onerror = null;
                this.recognition.onend = null;
                this.recognition.abort();
            } catch (e) {
                // ignore
            }
            this.recognition = null;
        }
    }

    /**
     * Stop both recognition and synthesis (used on project stop).
     */
    stopAll () {
        this.stopListening();
        this.stopSpeaking();
    }

    /**
     * Start listening and resolve when a result (or error) is received.
     * @returns {Promise} - resolves when recognition finishes.
     */
    listenAndWait () {
        // Clear the previous result so a failed/empty attempt does not leave
        // the last recognized text behind (e.g. when ambient noise triggers
        // recognition but nothing is actually transcribed).
        this.latestSpeech = '';

        const SpeechRecognition = getSpeechRecognition();
        if (!SpeechRecognition) {
            this.lastError = 'unsupported';
            console.warn('SpeechRecognition is not supported in this browser.');
            return Promise.resolve();
        }

        // Stop a previous session before starting a new one.
        this.stopListening();

        // Clear the previous error before a new attempt.
        this.lastError = '';

        return new Promise(resolve => {
            const recognition = new SpeechRecognition();
            this.recognition = recognition;
            recognition.lang = this.recognitionLanguage;
            recognition.interimResults = false;
            recognition.continuous = false;
            recognition.maxAlternatives = 1;

            const finish = () => {
                this.recognition = null;
                resolve();
            };

            recognition.onresult = event => {
                const result = event.results[event.results.length - 1];
                if (result && result[0]) {
                    const transcript = result[0].transcript.trim();
                    if (this.isAcceptableResult(transcript, result[0].confidence)) {
                        this.latestSpeech = transcript;
                    } else {
                        // Treat noisy / low-confidence / symbol-only results as nothing heard.
                        this.lastError = 'noise-filtered';
                    }
                }
                finish();
            };
            recognition.onerror = event => {
                this.lastError = event.error || 'unknown';
                console.warn(`SpeechRecognition error: ${event.error}`);
                finish();
            };
            recognition.onend = () => {
                // Resolve in case onresult was not fired (e.g. no speech).
                if (this.recognition === recognition) {
                    finish();
                }
            };

            try {
                recognition.start();
            } catch (e) {
                this.lastError = 'start-failed';
                console.warn(`Failed to start SpeechRecognition: ${e}`);
                finish();
            }
        });
    }

    /**
     * Noise filter: decide whether a recognition result is worth keeping.
     * Rejects empty / symbol-only results and results whose reported confidence
     * is positive but below the threshold (a confidence of 0 means "unknown"
     * and is not rejected).
     * @param {string} transcript - the recognized text (already trimmed).
     * @param {number} confidence - SpeechRecognitionAlternative.confidence (0-1).
     * @returns {boolean} - true if the result should be accepted.
     */
    isAcceptableResult (transcript, confidence) {
        const text = (transcript || '').trim();
        if (text.length < MIN_LENGTH || !MEANINGFUL_CHAR.test(text)) {
            return false;
        }
        if (typeof confidence === 'number' && confidence > 0 && confidence < CONFIDENCE_THRESHOLD) {
            return false;
        }
        return true;
    }

    /**
     * @returns {string} - the latest recognized speech.
     */
    getSpeech () {
        return this.latestSpeech;
    }

    /**
     * @returns {boolean} - whether the Web Speech API recognition is available.
     */
    isSupported () {
        return getSpeechRecognition() !== null;
    }

    /**
     * @param {object} args - the block's arguments.
     * @param {string} args.WORD - the word to search for.
     * @returns {boolean} - whether the latest speech contains the word.
     */
    speechContains (args) {
        const word = Cast.toString(args.WORD).trim().toLowerCase();
        if (word === '') return false;
        return this.latestSpeech.toLowerCase().indexOf(word) !== -1;
    }
}

export {ExtensionBlocks as default, ExtensionBlocks as blockClass};
