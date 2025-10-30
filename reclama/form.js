// Variables globales
let signaturePad;

// Ejecutar cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando formulario de reclamaciones...");
    initializeSignaturePad();
    setupEventListeners();
    setupDateField();
    populateFormFromURL();
    console.log("Formulario listo para su uso");
});

/**
 * Inicializa el pad de firma
 */
function initializeSignaturePad() {
    const canvas = document.getElementById('firmaPad');
    if (!canvas) {
        console.error('No se encontró el elemento canvas para el pad de firma');
        return;
    }
    resizeCanvas(canvas);
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 0.5,
        maxWidth: 2.5,
    });

    document.getElementById('clearSignature').addEventListener('click', () => {
        signaturePad.clear();
    });

    window.addEventListener('resize', () => resizeCanvas(canvas));
}

/**
 * Ajusta el tamaño del canvas de forma responsiva
 * @param {HTMLCanvasElement} canvas - El canvas a redimensionar
 */
function resizeCanvas(canvas) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    if (signaturePad) {
        signaturePad.clear(); // La firma se borra al redimensionar
    }
}

/**
 * Configura los event listeners del formulario
 */
function setupEventListeners() {
    const form = document.getElementById('reclamacionesForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateForm()) {
            procesarFormulario();
        }
    });
}

/**
 * Establece la fecha de hoy en el campo de fecha
 */
function setupDateField() {
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
}

/**
 * Rellena los campos del formulario a partir de los parámetros de la URL.
 */
function populateFormFromURL() {
    const params = new URLSearchParams(window.location.search);
    const expone = params.get('expone');
    const solicita = params.get('solicita');
    const documentos = params.get('documentos');
    let plantillaAplicada = false;

    if (expone) {
        const exponeTextarea = document.getElementById('expone');
        if (exponeTextarea) {
            exponeTextarea.value = expone;
            plantillaAplicada = true;
        }
    }

    if (solicita) {
        const solicitaTextarea = document.getElementById('solicita');
        if (solicitaTextarea) {
            solicitaTextarea.value = solicita;
            plantillaAplicada = true;
        }
    }

    if (documentos) {
        const documentosTextarea = document.getElementById('documentos');
        if (documentosTextarea) {
            documentosTextarea.value = documentos;
            plantillaAplicada = true;
        }
    }

    if (plantillaAplicada) {
        showNotification('Plantilla aplicada correctamente.');
    }
}

/**
 * Valida los campos del formulario
 * @returns {boolean} - true si el formulario es válido
 */
function validateForm() {
    const camposObligatorios = ['Nombre', 'Apellidos', 'NIF', 'ESP', 'mail', 'tel', 'expone', 'solicita', 'fecha'];
    for (const id of camposObligatorios) {
        const campo = document.getElementById(id);
        if (!campo.value.trim()) {
            alert(`El campo "${campo.previousElementSibling?.textContent || id}" es obligatorio.`);
            campo.focus();
            return false;
        }
    }

    if (signaturePad.isEmpty()) {
        alert('Es necesario firmar el documento.');
        return false;
    }

    return true;
}

/**
 * Procesa el formulario y genera el PDF
 */
async function procesarFormulario() {
    const submitButton = document.querySelector('#reclamacionesForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.querySelector('div').innerHTML = 'Generando PDF... <span class="loader"></span>';


    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        // 1. Cargar la plantilla PDF y la fuente monoespaciada
        const pdfPath = '/reclama/FORMULARIO-EXPONE_SOLICITA.pdf';
        const existingPdfBytes = await fetch(pdfPath).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();

        // 2. Recopilar datos del formulario
        const formData = new FormData(document.getElementById('reclamacionesForm'));
        const datosFormulario = Object.fromEntries(formData.entries());

        // 3. Definir posiciones y dibujar texto
        const positions = {
            apellidos: { x: 105, y: 685 },
            nombre: { x: 100, y: 667 },
            nif: { x: 85, y: 649 },
            especialidad: { x: 165, y: 631 },
            email: { x: 140, y: 614 },
            telefono: { x: 430, y: 614 },
            expone: { x: 70, y: 584, maxWidth: 450 },
            solicita: { x: 70, y: 410, maxWidth: 450 },
            documentos: { x: 70, y: 243, maxWidth: 450 },
            firma: { x: 230, y: 112, width: 150, height: 45 },
            dia: { x: 239, y: 177 },
            mes: { x: 288, y: 177 },
            ano: { x: 420, y: 177 }
        };
        
        const fontSize = 11;
        const fontColor = rgb(0, 0, 0);

        // Truncar textos largos para evitar desbordamiento
        const maxNameWidth = 200;
        const nombreText = truncateText(datosFormulario.Nombre || '', monoFont, fontSize, maxNameWidth);
        const apellidosText = truncateText(datosFormulario.Apellidos || '', monoFont, fontSize, maxNameWidth);

        firstPage.drawText(nombreText, { ...positions.nombre, size: fontSize, color: fontColor, font: monoFont });
        firstPage.drawText(apellidosText, { ...positions.apellidos, size: fontSize, color: fontColor, font: monoFont });
        firstPage.drawText(datosFormulario.NIF || '', { ...positions.nif, size: fontSize, color: fontColor, font: monoFont });
        firstPage.drawText(datosFormulario.ESP || '', { ...positions.especialidad, size: fontSize, color: fontColor, font: monoFont });
        firstPage.drawText(datosFormulario.mail || '', { ...positions.email, size: fontSize, color: fontColor, font: monoFont });
        firstPage.drawText(datosFormulario.tel || '', { ...positions.telefono, size: fontSize, color: fontColor, font: monoFont });

        drawMultilineText(firstPage, datosFormulario.expone || '', positions.expone, monoFont, fontSize, fontColor);
        drawMultilineText(firstPage, datosFormulario.solicita || '', positions.solicita, monoFont, fontSize, fontColor);
        drawMultilineText(firstPage, datosFormulario.documentos || '', positions.documentos, monoFont, fontSize, fontColor);

        // Fecha
        if (datosFormulario.fecha) {
            const fechaObj = new Date(datosFormulario.fecha);
            const dia = fechaObj.getUTCDate().toString().padStart(2, '0');
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const mes = meses[fechaObj.getUTCMonth()];
            const ano = fechaObj.getUTCFullYear().toString().slice(-2);
            firstPage.drawText(dia, { ...positions.dia, size: fontSize, color: fontColor, font: monoFont });
            firstPage.drawText(mes, { ...positions.mes, size: fontSize, color: fontColor, font: monoFont });
            firstPage.drawText(ano, { ...positions.ano, size: fontSize, color: fontColor, font: monoFont });
        }

        // 4. Insertar firma
        if (!signaturePad.isEmpty()) {
            const firmaImgBase64 = signaturePad.toDataURL('image/png');
            const firmaImgBytes = await fetch(firmaImgBase64).then(res => res.arrayBuffer());
            const firmaImage = await pdfDoc.embedPng(firmaImgBytes);
            const firmaDims = firmaImage.scale(1);
            const { firma: firmaPos } = positions;
            const scale = Math.min(firmaPos.width / firmaDims.width, firmaPos.height / firmaDims.height);
            
            firstPage.drawImage(firmaImage, {
                x: firmaPos.x,
                y: firmaPos.y,
                width: firmaDims.width * scale,
                height: firmaDims.height * scale,
            });
        }

        // 5. Guardar y descargar el PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        
        const now = new Date();
        const dia = now.getDate().toString().padStart(2, '0');
        const mes = (now.getMonth() + 1).toString().padStart(2, '0');
        const nombre = datosFormulario.Nombre || 'Nombre';
        const apellidos = datosFormulario.Apellidos || 'Apellidos';

        link.download = `${dia}-${mes}_${apellidos}_${nombre}_FORMULARIO-EXPONE_SOLICITA.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('PDF generado y descargado con éxito.');

    } catch (error) {
        console.error('Error al generar el PDF:', error);
        alert('Hubo un error al generar el PDF. Revisa la consola para más detalles.');
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector('div').innerHTML = 'Descargar PDF <span class="material-symbols-outlined"> arrow_forward </span>';
    }
}

/**
 * Muestra una notificación emergente (chip).
 * @param {string} message - El mensaje a mostrar.
 * @param {number} [duration=5000] - La duración en milisegundos.
 */
function showNotification(message, duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('El contenedor de notificaciones no se encuentra.');
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'notification-chip';
    notification.textContent = message;

    container.appendChild(notification);

    // Forzar un reflow para que la animación de entrada funcione
    notification.offsetHeight; 

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        // Esperar a que la animación de salida termine para eliminar el elemento
        notification.addEventListener('transitionend', () => {
            notification.remove();
        });
    }, duration);
}


/**
 * Dibuja texto multilínea en una página de PDF
 */
function drawMultilineText(page, text, position, font, fontSize, color) {
    const { x, y, maxWidth } = position;
    const lineHeight = fontSize * 1.2;
    const charWidth = font.widthOfTextAtSize('a', fontSize);
    const maxChars = Math.floor(maxWidth / charWidth);
    let words = text.replace(/\n/g, ' \n ').split(' ');
    words = words.flatMap(word => {
        if (word === '\n' || word.length <= maxChars) return [word];
        let parts = [];
        for (let i = 0; i < word.length; i += maxChars) {
            parts.push(word.substr(i, maxChars));
        }
        return parts;
    });
    let currentLine = '';
    let currentY = y;

    for (const word of words) {
        if (word === '\n') {
            page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
            currentLine = '';
            currentY -= lineHeight;
            continue;
        }
        
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
            page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
            currentLine = word;
            currentY -= lineHeight;
        } else {
            currentLine = testLine;
        }
    }
    page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
}

/**
 * Trunca el texto si excede el ancho máximo
 */
function truncateText(text, font, size, maxWidth) {
    if (!text) return '';
    let width = font.widthOfTextAtSize(text, size);
    if (width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', size) > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
}

