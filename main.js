
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const actionsContainer = document.getElementById('actions-container');
const predictBtn = document.getElementById('predict-btn');
const resetBtn = document.getElementById('reset-btn');
const hfTokenInput = document.getElementById('hf-token');
const resultSection = document.getElementById('result-section');
const loader = document.getElementById('loader');
const resultText = document.getElementById('result-text');
const confidenceContainer = document.getElementById('confidence-container');
const confidenceFill = document.getElementById('confidence-fill');
const confidenceText = document.getElementById('confidence-text');

let currentImageBlob = null;

// Using a fast, reliable model from Hugging Face that has "hotdog" in its ImageNet categories.
const MODEL_URL = "https://api-inference.huggingface.co/models/google/vit-base-patch16-224";

// Drag and drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
  let dt = e.dataTransfer;
  let files = dt.files;
  handleFiles(files);
});

browseBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', function() {
  handleFiles(this.files);
});

function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  
  if (!file.type.startsWith('image/')) {
    alert('Please upload a valid image file (.jpg, .png, .jpeg, etc.)');
    return;
  }

  currentImageBlob = file;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    previewContainer.classList.remove('hidden');
    actionsContainer.classList.remove('hidden');
    
    // Hide previous results
    resultSection.classList.add('hidden');
    predictBtn.disabled = false;
    predictBtn.textContent = "Predict";
    confidenceFill.style.width = '0%';
  };
  
  reader.readAsDataURL(file);
}

resetBtn.addEventListener('click', () => {
    currentImageBlob = null;
    fileInput.value = '';
    previewContainer.classList.add('hidden');
    actionsContainer.classList.add('hidden');
    resultSection.classList.add('hidden');
    imagePreview.src = '';
    confidenceFill.style.width = '0%';
});

predictBtn.addEventListener('click', async () => {
  const token = hfTokenInput.value.trim();
  if (!token) {
    alert("Please enter your Hugging Face API token. This is required to run the inference.");
    hfTokenInput.focus();
    return;
  }
  
  if (!currentImageBlob) {
    alert("Please upload an image first.");
    return;
  }

  // Update UI for loading state
  resultSection.classList.remove('hidden');
  loader.classList.remove('hidden');
  resultText.classList.add('hidden');
  confidenceContainer.classList.add('hidden');
  confidenceText.classList.add('hidden');
  predictBtn.disabled = true;
  predictBtn.textContent = "Analyzing...";
  confidenceFill.style.width = '0%';

  try {
    const arrayBuffer = await currentImageBlob.arrayBuffer();
    const result = await queryHF(arrayBuffer, token);
    
    if (result.error) {
      if(result.estimated_time) {
          throw new Error(`Model is loading. Please try again in ~${Math.ceil(result.estimated_time)} seconds.`);
      }
      throw new Error(result.error);
    }
    
    analyzeResult(result);
  } catch (error) {
    console.error("Inference error:", error);
    alert(`Oops: ${error.message}`);
    resultSection.classList.add('hidden');
  } finally {
    loader.classList.add('hidden');
    predictBtn.disabled = false;
    predictBtn.textContent = "Predict Again";
  }
});

async function queryHF(data, token) {
  const response = await fetch(MODEL_URL, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
    body: data,
  });
  
  if(!response.ok && response.status !== 503) {
      if(response.status === 401) throw new Error("Invalid API Token. Please check your Hugging Face token.");
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result;
}

function analyzeResult(predictions) {
    if (!Array.isArray(predictions)) {
        throw new Error(`Unexpected API response format. Check the API token or the backend response. Details: ${JSON.stringify(predictions)}`);
    }

    let isHotDog = false;
    let confidence = 0;
    
    for (const p of predictions) {
        const lbl = p.label.toLowerCase();
        if (lbl.includes('hotdog') || lbl.includes('hot dog') || lbl.includes('frankfurter')) {
            isHotDog = true;
            confidence = p.score;
            break;
        }
    }

    if (!isHotDog && predictions.length > 0) {
        confidence = predictions[0].score;
    }

    resultText.classList.remove('hidden');
    confidenceContainer.classList.remove('hidden');
    confidenceText.classList.remove('hidden');

    if (isHotDog) {
        resultText.textContent = "Hot Dog!";
        resultText.className = "result-text hotdog";
    } else {
        resultText.textContent = "Not Hot Dog!";
        resultText.className = "result-text nothotdog";
    }

    const confidencePercentage = (confidence * 100).toFixed(1);
    
    confidenceFill.style.backgroundColor = isHotDog ? "var(--hotdog-color)" : "var(--nothotdog-color)";
    
    setTimeout(() => {
        confidenceFill.style.width = `${confidencePercentage}%`;
    }, 50);
    
    confidenceText.textContent = `Confidence: ${confidencePercentage}%`;
}
