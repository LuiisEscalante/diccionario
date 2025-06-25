// --- ELEMENTOS DEL DOM ---
const apiKeyContainer = document.getElementById('api-key-container');
const appContainer = document.getElementById('app-container');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key');
const chatWindow = document.getElementById('chat-window');
const wordInput = document.getElementById('word-input');
const simpleBtn = document.getElementById('simple-btn');
const completeBtn = document.getElementById('complete-btn');

let API_KEY = '';
let conversationHistory = []; // Para mantener la memoria del chat

// --- LÓGICA DE API KEY ---
saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        API_KEY = key;
        localStorage.setItem('gemini_api_key', key);
        apiKeyContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        initializeChat();
    } else {
        alert('Por favor, ingresa una clave API válida.');
    }
});

function checkApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        API_KEY = savedKey;
        apiKeyContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        initializeChat();
    }
}

// --- LÓGICA DEL CHAT ---
async function initializeChat() {
    addMessage("bot", `<h3>¡Hola! Soy tu Diccionario IA.</h3><p>Para empezar, escribe una palabra o elige una de estas sugerencias complejas e interesantes generadas por IA.</p>`);
    
    // Añadir loader mientras se obtienen sugerencias
    const loaderId = 'initial-loader';
    addMessage("bot", `<div class="loader" id="${loaderId}"></div>`, loaderId);

    const prompt = "Genera 3 palabras en español que sean complejas, interesantes o poco comunes. Devuélvelas en un array JSON simple llamado 'sugerencias'. Por ejemplo: {\"sugerencias\": [\"palabra1\", \"palabra2\", \"palabra3\"]}";
    
    try {
        const response = await callGeminiAPI(prompt, true); // true para parsear JSON
        const suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'suggestion-buttons-container';

        response.sugerencias.forEach(word => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = word;
            btn.onclick = () => {
                wordInput.value = word;
                handleRequest('completa'); // Las sugerencias usan el modo completo por defecto
            };
            suggestionContainer.appendChild(btn);
        });
        
        // Reemplazar loader con los botones
        const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
             loaderElement.parentElement.appendChild(suggestionContainer);
             loaderElement.remove();
        }

    } catch (error) {
        console.error("Error al obtener sugerencias:", error);
        const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
            loaderElement.parentElement.innerHTML = '<p>No se pudieron cargar las sugerencias. ¡Pero aún puedes escribir la tuya!</p>';
        }
    }
}

async function handleRequest(type) {
    const word = wordInput.value.trim();
    if (!word) return;

    addMessage('user', word);
    wordInput.value = '';

    const loaderId = `loader-${Date.now()}`;
    addMessage('bot', `<div class="loader" id="${loaderId}"></div>`, loaderId);

    let prompt = '';
    if (type === 'simple') {
        prompt = `Define la palabra "${word}" de una forma completamente sencilla y fácil de entender para cualquier persona.`;
    } else {
        prompt = `Quiero una definición completa para la palabra "${word}". Estructura tu respuesta obligatoriamente en el siguiente formato JSON, sin texto introductorio ni explicaciones fuera del JSON:
        {
          "definicionSencilla": "una definición clara y simple",
          "etimologia": "La etimología detallada de la palabra, explicando sus raíces (griego, latín, etc.).",
          "evolucion": "Una explicación avanzada de cómo el significado de la palabra ha evolucionado a través de la historia.",
          "sinonimos": ["lista", "de", "sinónimos"],
          "antonimos": ["lista", "de", "antónimos"],
          "sugerencias": ["pregunta de seguimiento 1", "pregunta de seguimiento 2", "pregunta de seguimiento 3"]
        }`;
    }

    try {
        const isJson = type === 'completa';
        const response = await callGeminiAPI(prompt, isJson);
        const botResponseHtml = formatBotResponse(response, isJson);
        
        // Reemplazar loader con la respuesta final
        const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
            loaderElement.parentElement.innerHTML = botResponseHtml;
        }

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
            loaderElement.parentElement.innerHTML = `<p>Lo siento, ha ocurrido un error. Por favor, revisa tu clave API y la consola para más detalles.</p>`;
        }
    }
}

async function handleFollowUp(question) {
    addMessage('user', question);
    const loaderId = `loader-${Date.now()}`;
    addMessage('bot', `<div class="loader" id="${loaderId}"></div>`, loaderId);
    
    try {
        const response = await callGeminiAPI(question, false); // La respuesta a una pregunta abierta es texto plano
        const botResponseHtml = formatBotResponse(response, false);

        const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
            loaderElement.parentElement.innerHTML = botResponseHtml;
        }

    } catch(error) {
        console.error("Error en pregunta de seguimiento:", error);
         const loaderElement = document.getElementById(loaderId);
        if(loaderElement) {
            loaderElement.parentElement.innerHTML = `<p>Lo siento, no pude procesar esa pregunta.</p>`;
        }
    }
}


// --- FUNCIONES AUXILIARES ---

function addMessage(sender, content, elementId = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    if(elementId) {
        messageDiv.id = elementId;
    }
    messageDiv.innerHTML = content;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll
}


async function callGeminiAPI(prompt, parseJson) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    // Construir el historial de la conversación para la API
    const contents = [...conversationHistory];
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const body = { contents };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Error de la API: ${errorBody.error.message}`);
    }

    const data = await response.json();
    const botResponseText = data.candidates[0].content.parts[0].text;

    // Actualizar historial de conversación
    conversationHistory.push({ role: 'user', parts: [{ text: prompt }] });
    conversationHistory.push({ role: 'model', parts: [{ text: botResponseText }] });

    if (parseJson) {
        // Limpiar el texto para que sea un JSON válido
        const cleanedJsonString = botResponseText.replace(/```json|```/g, '').trim();
        return JSON.parse(cleanedJsonString);
    }
    return botResponseText;
}

function formatBotResponse(response, isJson) {
    if (!isJson) {
        // Para respuestas simples o de seguimiento
        return `<p>${response.replace(/\n/g, '<br>')}</p>`;
    }

    // Para respuestas completas
    let html = `<h3>${wordInput.value}</h3>`;
    html += `<p><strong>Definición:</strong> ${response.definicionSencilla}</p>`;
    html += `<p><strong>Etimología:</strong> ${response.etimologia}</p>`;
    html += `<p><strong>Evolución Histórica:</strong> ${response.evolucion}</p>`;
    
    if (response.sinonimos && response.sinonimos.length > 0) {
        html += `<p><strong>Sinónimos:</strong> ${response.sinonimos.join(', ')}</p>`;
    }
    if (response.antonimos && response.antonimos.length > 0) {
        html += `<p><strong>Antónimos:</strong> ${response.antonimos.join(', ')}</p>`;
    }
    
    if (response.sugerencias && response.sugerencias.length > 0) {
        html += `<div class="suggestion-buttons-container">`;
        response.sugerencias.forEach(sug => {
            html += `<button class="suggestion-btn" onclick="handleFollowUp('${sug.replace(/'/g, "\\'")}')">${sug}</button>`;
        });
        html += `</div>`;
    }
    return html;
}


// --- INICIALIZACIÓN ---
wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleRequest('completa');
    }
});

simpleBtn.addEventListener('click', () => handleRequest('simple'));
completeBtn.addEventListener('click', () => handleRequest('completa'));

// Comprobar si ya existe una API Key al cargar la página
checkApiKey();