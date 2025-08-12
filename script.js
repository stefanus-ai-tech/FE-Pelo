const recordButton = document.getElementById('recordButton');
const recordingStatus = document.getElementById('recordingStatus');
const initialTranscriptionElem = document.getElementById('initialTranscription');
const finalSoundElem = document.getElementById('finalSound');
const finalAudioElem = document.getElementById('finalAudio');
const resultsDiv = document.getElementById('results');

// --- NEW: Get reference to both model and prompt selectors ---
const modelSelector = document.getElementById('modelSelector');
const promptSelector = document.getElementById('promptSelector'); // <-- ADDED

// --- Define the base URL for your backend API ---
(async () => {
    const primary = 'https://doorz.stefanusadri.my.id';
    const fallback = 'https://pelo.stefanusadri.my.id';

    const API_BASE_URL = await (async () => {
        try {
            await fetch(primary, { method: 'HEAD', mode: 'no-cors' });
            return primary;
        } catch {
            console.warn(`Primary API not reachable, switching to fallback: ${fallback}`);
            return fallback;
        }
    })();

    console.log(`Using API: ${API_BASE_URL}`);
})();



async function checkApiUrl() {
    try {
        const res = await fetch(API_BASE_URL, { method: 'HEAD', mode: 'no-cors' });
        // If the fetch succeeds, keep using the remote URL
        console.log(`Using remote API: ${API_BASE_URL}`);
    } catch (error) {
        // If it fails, fallback to localhost
        API_BASE_URL = 'http://localhost:8001';
        console.warn(`Remote API unreachable. Falling back to: ${API_BASE_URL}`);
    }
}

// Run the check before making API calls
checkApiUrl();


let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let mediaStream = null;

async function initializeAudio() {
    // This function is unchanged
    if (mediaStream) {
        return true;
    }
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Could not access microphone. Please allow microphone access in your browser settings and refresh the page.");
        return false;
    }
}

recordButton.addEventListener('click', async () => {
    // This function is unchanged
    if (!isRecording) {
        const audioInitialized = await initializeAudio();
        if (!audioInitialized) {
            return;
        }

        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = sendAudioToServer;
        mediaRecorder.start();

        recordButton.classList.add('recording');
        recordingStatus.textContent = 'Recording... Press to stop.';
        isRecording = true;

    } else {
        mediaRecorder.stop();
        recordButton.classList.remove('recording');
        recordingStatus.textContent = 'Processing...';
        isRecording = false;
    }
});

// --- MODIFIED sendAudioToServer function ---
async function sendAudioToServer() {
    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
    audioChunks = [];

    // Get the selected values from BOTH dropdowns
    const selectedModel = modelSelector.value;
    const selectedPrompt = promptSelector.value; // <-- ADDED

    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    // Add BOTH selections to the form data
    formData.append('model_selection', selectedModel);
    formData.append('prompt_selection', selectedPrompt); // <-- ADDED

    resultsDiv.classList.remove('hidden');
    initialTranscriptionElem.textContent = 'Transcribing...';
    finalSoundElem.textContent = 'Refining...';
    finalAudioElem.classList.remove('visible');
    finalAudioElem.src = ''; 

    try {
        const response = await fetch(`${API_BASE_URL}/process_audio`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Server error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();

        initialTranscriptionElem.textContent = data.initial_transcription;
        finalSoundElem.textContent = data.natural_text;

        const audioResponse = await fetch(`${API_BASE_URL}/get_response_audio`);
        if (audioResponse.ok) {
            const audioBlob = await audioResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            finalAudioElem.src = audioUrl;
            finalAudioElem.classList.add('visible');
            recordingStatus.textContent = 'Done! Record another?';
        } else {
            console.error("Could not fetch the generated audio file.");
            recordingStatus.textContent = 'Error fetching audio.';
        }

    } catch (error) {
        console.error("Error processing audio:", error);
        initialTranscriptionElem.textContent = 'An error occurred during processing.';
        finalSoundElem.textContent = '-';
        recordingStatus.textContent = `Error: ${error.message}`;
    }
}
