// js/app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCAcPPjMoVWQ_BumIWkbDnJSUXuQ6Z2GsM",
    authDomain: "power-gaming-358dc.firebaseapp.com",
    projectId: "power-gaming-358dc",
    storageBucket: "power-gaming-358dc.firebasestorage.app",
    messagingSenderId: "544855386765",
    appId: "1:544855386765:web:41931def28419f56ef90c4",
    measurementId: "G-BJX0P895MN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productosCollection = collection(db, 'productos');
const pedidosCollection = collection(db, 'pedidos');
const auth = getAuth(app);

// --- Funciones de Alerta y Confirmación Personalizadas ---

function mostrarAlerta(message, type = 'info', duration = 3000) {
    const alertContainer = document.getElementById('custom-alert-container');
    if (!alertContainer) {
        console.error('Contenedor de alertas no encontrado. Asegúrate de tener <div id="custom-alert-container"></div> en tu HTML.');
        alert(message);
        return;
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert custom-alert-${type}`;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button type="button" class="close-btn" aria-label="Close">&times;</button>
    `;

    alertContainer.appendChild(alertDiv);

    void alertDiv.offsetWidth;
    alertDiv.classList.add('show');

    setTimeout(() => {
        alertDiv.classList.remove('show');
        alertDiv.addEventListener('transitionend', () => alertDiv.remove());
    }, duration);

    alertDiv.querySelector('.close-btn').addEventListener('click', () => {
        alertDiv.classList.remove('show');
        alertDiv.addEventListener('transitionend', () => alertDiv.remove());
    });
}

function mostrarConfirmacion(message, title = 'Confirmación') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const backdrop = document.getElementById('custom-modal-backdrop');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeBtn = modal.querySelector('.close-modal-btn');

        if (!modal || !backdrop || !modalTitle || !modalMessage || !confirmBtn || !cancelBtn || !closeBtn) {
            console.error('Elementos del modal de confirmación no encontrados. Asegúrate de tener la estructura HTML correcta.');
            resolve(window.confirm(message));
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;

        backdrop.classList.remove('hidden');
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        backdrop.classList.add('show');
        modal.classList.add('show');

        const closeAndResolve = (result) => {
            modal.classList.remove('show');
            backdrop.classList.remove('show');
            modal.addEventListener('transitionend', () => {
                modal.classList.add('hidden');
                backdrop.classList.add('hidden');
                resolve(result);
            }, { once: true });
        };

        confirmBtn.onclick = () => closeAndResolve(true);
        cancelBtn.onclick = () => closeAndResolve(false);
        closeBtn.onclick = () => closeAndResolve(false);
    });
}


// --- Funciones CRUD para productos (usan Firestore) ---

async function obtenerTodosLosProductos() {
    try {
        const snapshot = await getDocs(productosCollection);
        const productosArr = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return productosArr;
    } catch (error) {
        console.error("Error al obtener productos de Firestore:", error);
        mostrarAlerta("Error al obtener productos de Firestore.", "danger");
        return [];
    }
}

async function agregarNuevoProducto(nombre, precio, imagen, stock) {
    try {
        const docRef = await addDoc(productosCollection, {
            nombre,
            precio: Number(precio),
            imagen: imagen || 'img/placeholder.webp',
            stock: Number(stock) || 0
        });
        console.log("Documento escrito con ID:", docRef.id);
        return true;
    } catch (error) {
        console.error("Error al agregar producto a Firestore:", error);
        mostrarAlerta("Error al agregar producto a Firestore.", "danger");
        return false;
    }
}

async function eliminarDocumentoPorId(collectionRef, docId) {
    try {
        await deleteDoc(doc(collectionRef, docId));
        console.log(`Documento ${docId} eliminado con éxito de la colección ${collectionRef.id}.`);
        return true;
    } catch (error) {
        console.error(`Error al eliminar documento ${docId} de la colección ${collectionRef.id}:`, error);
        mostrarAlerta(`Error al eliminar documento ${docId}.`, "danger");
        return false;
    }
}

async function actualizarProducto(id, nombre, precio, imagen, stock) {
    try {
        const productoRef = doc(productosCollection, id);
        await updateDoc(productoRef, {
            nombre,
            precio: Number(precio),
            imagen: imagen || 'img/placeholder.webp',
            stock: Number(stock)
        });
        console.log("Documento actualizado con éxito.");
        return true;
    } catch (error) {
        console.error("Error al actualizar producto en Firestore:", error);
        mostrarAlerta("Error al actualizar producto en Firestore.", "danger");
        return false;
    }
}


// --- Lógica del Panel de Administración (CRUD con interfaz) ---

/**
 * Carga y muestra los productos en la interfaz del panel de administración.
 * Permite editar y eliminar productos.
 */
async function cargarProductosEnAdmin() {
    const contenedor = document.getElementById('lista-productos-admin');
    if (!contenedor) return;

    const productosActuales = await obtenerTodosLosProductos();
    contenedor.innerHTML = '';

    if (productosActuales.length === 0) {
        contenedor.innerHTML = '<p>No hay productos en la base de datos. ¡Agrega uno!</p>';
    }

    productosActuales.forEach(p => {
        const div = document.createElement('div');
        div.className = 'producto-admin';
        div.innerHTML = `
            <p><strong>${p.nombre}</strong> - $${p.precio.toLocaleString()} - Stock: ${p.stock || 0}</p>
            <div class="actions">
                <button class="editar" data-id="${p.id}">Editar</button>
                <button class="eliminar" data-id="${p.id}">Eliminar</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    document.querySelectorAll('#lista-productos-admin .eliminar').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            const id = event.target.getAttribute('data-id');
            const confirmado = await mostrarConfirmacion('¿Estás seguro de que quieres eliminar este producto?', 'Confirmar Eliminación');
            if (confirmado) {
                if (await eliminarDocumentoPorId(productosCollection, id)) {
                    cargarProductosEnAdmin();
                    mostrarAlerta('Producto eliminado con éxito.', "success");
                } else {
                    mostrarAlerta('Error al eliminar el producto.', "danger");
                }
            }
        });
    });

    document.querySelectorAll('#lista-productos-admin .editar').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            const id = event.target.getAttribute('data-id');
            const productosDisponibles = await obtenerTodosLosProductos();
            const productoAEditar = productosDisponibles.find(p => p.id === id);
            if (productoAEditar) {
                prepararEdicionProducto(productoAEditar);
            } else {
                mostrarAlerta('Producto no encontrado para editar.', "warning");
            }
        });
    });
}

async function manejarFormularioAgregar(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombre').value.trim();
    const precio = document.getElementById('precio').value.trim();
    const imagen = document.getElementById('imagen').value.trim();
    const stock = document.getElementById('stock').value.trim();

    if (!nombre || !precio || !stock) {
        mostrarAlerta('Nombre, precio y stock son obligatorios', "warning");
        return;
    }

    if (await agregarNuevoProducto(nombre, precio, imagen, stock)) {
        e.target.reset();
        cargarProductosEnAdmin();
        mostrarAlerta('Producto agregado con éxito.', "success");
    } else {
        mostrarAlerta('Hubo un error al agregar el producto.', "danger");
    }
}

function prepararEdicionProducto(productoAEditar) {
    document.getElementById('edit-id').value = productoAEditar.id;
    document.getElementById('edit-nombre').value = productoAEditar.nombre;
    document.getElementById('edit-precio').value = productoAEditar.precio;
    document.getElementById('edit-imagen').value = productoAEditar.imagen;
    document.getElementById('edit-stock').value = productoAEditar.stock || 0;

    document.getElementById('form-agregar-producto').classList.add('hidden');
    document.getElementById('form-editar-producto').classList.remove('hidden');
}

async function manejarFormularioEditar(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('edit-nombre').value.trim();
    const precio = document.getElementById('edit-precio').value.trim();
    const imagen = document.getElementById('edit-imagen').value.trim();
    const stock = document.getElementById('edit-stock').value.trim();

    if (!nombre || !precio || !stock) {
        mostrarAlerta('Nombre, precio y stock son obligatorios para la edición', "warning");
        return;
    }

    if (await actualizarProducto(id, nombre, precio, imagen, stock)) {
        cargarProductosEnAdmin();
        cancelarEdicion();
        mostrarAlerta('Producto actualizado con éxito.', "success");
    } else {
        mostrarAlerta('Error: No se pudo actualizar el producto.', "danger");
    }
}

function cancelarEdicion() {
    document.getElementById('form-editar-producto').classList.add('hidden');
    document.getElementById('form-agregar-producto').classList.remove('hidden');
    document.getElementById('form-editar-producto').reset();
}


// --- Lógica de Autenticación del Administrador ---

async function handleAdminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const errorMessageElement = document.getElementById('error-message');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'admin_panel.html';
    } catch (error) {
        console.error("Error al iniciar sesión:", error.code, error.message);
        let message = "Error al iniciar sesión. Intenta de nuevo.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = "Credenciales incorrectas (correo o contraseña).";
        } else if (error.code === 'auth/invalid-email') {
            message = "Formato de correo electrónico inválido.";
        } else if (error.code === 'auth/too-many-requests') {
            message = "Demasiados intentos fallidos. Inténtalo de nuevo más tarde.";
        }
        errorMessageElement.textContent = message;
        mostrarAlerta(message, "danger");
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = './admin_login.html';
    } catch (error) {
        console.error("Error al cerrar sesión:", error.message);
        mostrarAlerta('No se pudo cerrar la sesión.', "danger");
    }
}

function protectAdminRoute() {
    onAuthStateChanged(auth, (user) => {
        const currentPath = window.location.pathname;

        if (user) {
            console.log("Usuario administrador logueado:", user.email);
            if (currentPath.includes('admin_login.html')) {
                window.location.href = 'admin_panel.html';
            }
        } else {
            console.log("No hay usuario administrador logueado.");
            if (currentPath.includes('admin_panel.html') || currentPath.includes('admin_pedidos.html')) {
                window.location.href = 'admin_login.html';
            }
        }
    });
}


// --- Lógica del Carrito (incluye manejo de cantidades) ---

function actualizarContadorCarrito() {
    const carrito = JSON.parse(localStorage.getItem("carrito")) || [];
    const contador = document.getElementById("contador-carrito");
    if (contador) {
        const totalItems = carrito.reduce((sum, item) => sum + (item.cantidad || 1), 0);
        contador.textContent = totalItems;
    }
}

async function mostrarProductosEnTienda() {
    const lista = document.getElementById('lista-productos');
    if (!lista) return;

    const productosActuales = await obtenerTodosLosProductos();
    lista.innerHTML = '';

    if (productosActuales.length === 0) {
        lista.innerHTML = '<p>No hay productos disponibles en este momento.</p>';
    }

    productosActuales.forEach((prod) => {
        const card = document.createElement('div');
        card.className = 'card producto';

        const img = document.createElement('img');
        const isProductsPage = window.location.pathname.includes('pages/productos.html');
        img.src = (isProductsPage ? "../" : "") + (prod.imagen || 'img/placeholder.webp');
        img.onerror = () => img.src = (isProductsPage ? '../img/placeholder.webp' : 'img/placeholder.webp');

        const nombre = document.createElement('h3');
        nombre.textContent = prod.nombre;

        const precio = document.createElement('p');
        precio.textContent = `$${prod.precio.toLocaleString()}`;
        precio.style.color = 'black';
        
        const stockInfo = document.createElement('p');
        stockInfo.style.color = 'black';
        stockInfo.style.fontSize = '0.9em';
        stockInfo.textContent = `Stock: ${prod.stock || 0}`;

        const btnAgregar = document.createElement('button');
        btnAgregar.textContent = 'Agregar al carrito';
        btnAgregar.disabled = (prod.stock || 0) <= 0;
        btnAgregar.onclick = () => agregarAlCarrito(prod.id);

        card.appendChild(img);
        card.appendChild(nombre);
        card.appendChild(precio);
        card.appendChild(stockInfo);
        card.appendChild(btnAgregar);

        lista.appendChild(card);
    });
}

function mostrarCarritoEmergente() {
    const carritoEmergenteDiv = document.getElementById('carrito-emergente');
    const contenido = document.getElementById('contenido-carrito-emergente');
    const contador = document.getElementById('contador-carrito');
    const totalCarritoSpan = document.getElementById('total-carrito');

    if (!carritoEmergenteDiv || !contenido || !contador) {
        return;
    }

    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];

    contador.textContent = carrito.reduce((sum, item) => sum + (item.cantidad || 1), 0);

    if (carrito.length === 0) {
        contenido.innerHTML = '<p>El carrito está vacío.</p>';
        if (totalCarritoSpan) totalCarritoSpan.textContent = '$0';
        const finalizarCompraBtn = document.querySelector('#carrito-emergente button[onclick="irACheckout()"]');
        if (finalizarCompraBtn) finalizarCompraBtn.disabled = true;
        return;
    }

    const ul = document.createElement('ul');
    let totalGlobal = 0;

    carrito.forEach((item, index) => {
        const li = document.createElement('li');
        const subtotal = (item.precio || 0) * (item.cantidad || 1);
        totalGlobal += subtotal;

        li.innerHTML = `
            ${item.nombre} (x${item.cantidad}) - $${item.precio ? item.precio.toLocaleString() : 'N/A'} 
            <span>SUBT: $${subtotal.toLocaleString()}</span>
            <button class="eliminar-item-carrito" data-index="${index}">X</button>
        `;
        ul.appendChild(li);
    });

    contenido.innerHTML = '';
    contenido.appendChild(ul);

    if (totalCarritoSpan) {
        totalCarritoSpan.textContent = `$${totalGlobal.toLocaleString()}`;
    }

    const finalizarCompraBtn = document.querySelector('#carrito-emergente button[onclick="irACheckout()"]');
    if (finalizarCompraBtn) finalizarCompraBtn.disabled = false;


    document.querySelectorAll('.eliminar-item-carrito').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const index = parseInt(event.target.getAttribute('data-index'));
            eliminarDelCarrito(index);
        });
    });
}

async function agregarAlCarrito(productId) {
    const productosFirestore = await obtenerTodosLosProductos();
    const productoSeleccionado = productosFirestore.find(p => p.id === productId);

    if (productoSeleccionado) {
        let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
        const productoExistente = carrito.find(item => item.id === productId);

        const cantidadEnCarrito = productoExistente ? (productoExistente.cantidad || 0) : 0;

        if (cantidadEnCarrito >= productoSeleccionado.stock) {
            mostrarAlerta(`No puedes agregar más de ${productoSeleccionado.stock} unidades de ${productoSeleccionado.nombre}. ¡Stock máximo alcanzado!`, "warning");
            return;
        }

        if (productoExistente) {
            productoExistente.cantidad = (productoExistente.cantidad || 1) + 1;
        } else {
            carrito.push({ ...productoSeleccionado, cantidad: 1 });
        }

        localStorage.setItem('carrito', JSON.stringify(carrito));
        mostrarCarritoEmergente();
        actualizarContadorCarrito();
        mostrarAlerta(`"${productoSeleccionado.nombre}" agregado al carrito.`, "success", 1500);
    } else {
        console.error('Producto no encontrado en Firestore para agregar al carrito:', productId);
        mostrarAlerta('Producto no encontrado para agregar al carrito.', "danger");
    }
}

function eliminarDelCarrito(index) {
    let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
    const productoEliminado = carrito[index];
    carrito.splice(index, 1);

    localStorage.setItem('carrito', JSON.stringify(carrito));
    mostrarCarritoEmergente();
    actualizarContadorCarrito();
    if (productoEliminado) {
        mostrarAlerta(`"${productoEliminado.nombre}" eliminado del carrito.`, "info", 1500);
    }
}

window.vaciarCarrito = function() {
    localStorage.removeItem('carrito');
    mostrarCarritoEmergente();
    actualizarContadorCarrito();
}

window.irACheckout = function() {
    const carritoActual = JSON.parse(localStorage.getItem('carrito')) || [];
    if (carritoActual.length === 0) {
        mostrarAlerta('El carrito está vacío. Agrega productos antes de finalizar la compra.', "warning");
        return;
    }

    const currentPath = window.location.pathname;
    let checkoutPath = '';
    if (currentPath.includes('/pages/')) {
        checkoutPath = 'checkout.html';
    } else {
        checkoutPath = 'pages/checkout.html';
    }
    window.location.href = checkoutPath;
}


// --- LÓGICA DE PEDIDOS PARA EL CLIENTE (Checkout) ---

async function guardarPedidoYActualizarStock(datosCliente, productosEnCarrito) {
    if (productosEnCarrito.length === 0) {
        console.warn("Intentando guardar un pedido con carrito vacío.");
        return false;
    }

    const totalPedido = productosEnCarrito.reduce((sum, item) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0);

    try {
        await runTransaction(db, async (transaction) => {
            const productosParaActualizar = [];
            
            for (const itemCarrito of productosEnCarrito) {
                const productoRef = doc(productosCollection, itemCarrito.id);
                const productoDoc = await transaction.get(productoRef);

                if (!productoDoc.exists()) {
                    throw new Error(`El producto con ID ${itemCarrito.id} no existe.`);
                }

                const currentStock = productoDoc.data().stock || 0;
                if (currentStock < itemCarrito.cantidad) {
                    throw new Error(`Stock insuficiente para ${itemCarrito.nombre}. Solo quedan ${currentStock} unidades.`);
                }
                
                productosParaActualizar.push({
                    ref: productoRef,
                    newStock: currentStock - itemCarrito.cantidad
                });
            }

            for (const prodUpdate of productosParaActualizar) {
                transaction.update(prodUpdate.ref, { stock: prodUpdate.newStock });
            }

            const newOrder = {
                ...datosCliente,
                productos: productosEnCarrito.map(item => ({
                    id: item.id,
                    nombre: item.nombre,
                    precio: item.precio || 0,
                    cantidad: item.cantidad || 1,
                    subtotal: (item.precio || 0) * (item.cantidad || 1)
                })),
                total: totalPedido,
                estado: "Pendiente",
                fechaPedido: serverTimestamp()
            };

            transaction.set(doc(pedidosCollection), newOrder);

        });

        localStorage.removeItem('carrito');
        actualizarContadorCarrito();
        mostrarCarritoEmergente();

        return true;

    } catch (error) {
        console.error("Error en la transacción del pedido:", error.message);
        mostrarAlerta(`Hubo un error al procesar tu pedido: ${error.message}. Por favor, inténtalo de nuevo.`, "danger");
        return false;
    }
}

function cargarResumenPedidoCheckout() {
    const productosResumenDiv = document.getElementById('productos-resumen');
    const totalResumenSpan = document.getElementById('total-resumen-checkout');

    if (!productosResumenDiv || !totalResumenSpan) return;

    const carrito = JSON.parse(localStorage.getItem('carrito')) || [];

    if (carrito.length === 0) {
        productosResumenDiv.innerHTML = '<p>No hay productos en el carrito.</p>';
        totalResumenSpan.textContent = '$0';
        const btnConfirmar = document.getElementById('btn-confirmar-compra');
        if(btnConfirmar) btnConfirmar.disabled = true;
        return;
    }

    const ul = document.createElement('ul');
    let totalGlobal = 0;

    carrito.forEach(item => {
        const li = document.createElement('li');
        const subtotal = (item.precio || 0) * (item.cantidad || 1);
        totalGlobal += subtotal;
        li.innerHTML = `
            <span>${item.nombre} (x${item.cantidad})</span>
            <span>$${subtotal.toLocaleString()}</span>
        `;
        ul.appendChild(li);
    });

    productosResumenDiv.innerHTML = '';
    productosResumenDiv.appendChild(ul);
    totalResumenSpan.textContent = `$${totalGlobal.toLocaleString()}`;
    
    const btnConfirmar = document.getElementById('btn-confirmar-compra');
    if(btnConfirmar) btnConfirmar.disabled = false;
}

async function handleCheckoutFormSubmit(e) {
    e.preventDefault();

    const nombre = document.getElementById('checkout-nombre').value.trim();
    const apellido = document.getElementById('checkout-apellido').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const telefono = document.getElementById('checkout-telefono').value.trim();
    const domicilio = document.getElementById('checkout-domicilio').value.trim();
    const localidad = document.getElementById('checkout-localidad').value.trim();
    const provincia = document.getElementById('checkout-provincia').value.trim();
    const cp = document.getElementById('checkout-cp').value.trim();

    if (!nombre || !apellido || !email || !telefono || !domicilio || !localidad || !provincia || !cp) {
        mostrarAlerta('Por favor, completa todos los campos de tus datos.', "warning");
        return;
    }

    const datosCliente = {
        nombre,
        apellido,
        email,
        telefono,
        domicilio,
        localidad,
        provincia,
        cp
    };

    const carritoActual = JSON.parse(localStorage.getItem('carrito')) || [];

    if (carritoActual.length === 0) {
        mostrarAlerta('El carrito está vacío. Agrega productos antes de finalizar la compra.', "warning");
        return;
    }

    if (await guardarPedidoYActualizarStock(datosCliente, carritoActual)) {
        mostrarAlerta('¡Tu pedido ha sido realizado con éxito!', "success");
        e.target.reset();
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
    } else {
    }
}


// --- LÓGICA DE PEDIDOS PARA EL ADMINISTRADOR ---

/**
 * Carga y muestra los pedidos en el panel de administración.
 * Permite actualizar el estado de los pedidos y eliminarlos.
 */
async function cargarPedidosEnAdmin() {
    const contenedor = document.getElementById('lista-pedidos-admin');
    if (!contenedor) return;

    try {
        const q = query(pedidosCollection, orderBy("fechaPedido", "desc"));
        const snapshot = await getDocs(q);
        const pedidosArr = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        contenedor.innerHTML = '';

        if (pedidosArr.length === 0) {
            contenedor.innerHTML = '<p>No hay pedidos registrados.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'pedidos-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>ID Pedido</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th>Domicilio</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        pedidosArr.forEach(pedido => {
            const tr = document.createElement('tr');

            const fecha = pedido.fechaPedido ? new Date(pedido.fechaPedido.seconds * 1000).toLocaleString() : 'N/A';
            const productosLista = pedido.productos.map(p => `<li>${p.nombre} (x${p.cantidad}) - $${(p.precio || 0).toLocaleString()}</li>`).join('');

            const estados = ['Pendiente', 'Enviado', 'Entregado', 'Cancelado'];
            const estadoSelectHtml = `
                <select class="estado-select" data-id="${pedido.id}">
                    ${estados.map(estado => `<option value="${estado}" ${pedido.estado === estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select>
            `;

            tr.innerHTML = `
                <td data-label="ID Pedido">${pedido.id}</td>
                <td data-label="Fecha">${fecha}</td>
                <td data-label="Cliente">${pedido.nombre} ${pedido.apellido}</td>
                <td data-label="Contacto">${pedido.email}<br>${pedido.telefono}</td>
                <td data-label="Domicilio">${pedido.domicilio}, CP: ${pedido.cp}<br>${pedido.localidad}, ${pedido.provincia}</td>
                <td data-label="Productos"><ul>${productosLista}</ul></td>
                <td data-label="Total">$${(pedido.total || 0).toLocaleString()}</td>
                <td data-label="Estado">${estadoSelectHtml}</td>
                <td data-label="Acciones" class="acciones-pedido">
                    <button class="eliminar-pedido" data-id="${pedido.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        contenedor.appendChild(table);

        document.querySelectorAll('.estado-select').forEach(select => {
            select.addEventListener('change', async (event) => {
                const pedidoId = event.target.getAttribute('data-id');
                const nuevoEstado = event.target.value;
                await actualizarEstadoPedido(pedidoId, nuevoEstado);
            });
        });

        document.querySelectorAll('.eliminar-pedido').forEach(btn => {
            btn.addEventListener('click', async (event) => {
                const id = event.target.getAttribute('data-id');
                const confirmado = await mostrarConfirmacion('¿Estás seguro de que quieres eliminar este pedido? Esta acción es irreversible.', 'Confirmar Eliminación');
                if (confirmado) {
                    if (await eliminarDocumentoPorId(pedidosCollection, id)) {
                        cargarPedidosEnAdmin();
                        mostrarAlerta('Pedido eliminado con éxito.', "success");
                    } else {
                        mostrarAlerta('Error al eliminar el pedido.', "danger");
                    }
                }
            });
        });

    } catch (error) {
        console.error("Error al cargar pedidos en admin:", error);
        mostrarAlerta("Error al cargar pedidos.", "danger");
    }
}

/**
 * Actualiza el estado de un pedido en Firestore.
 * @param {string} pedidoId - ID del pedido a actualizar.
 * @param {string} nuevoEstado - El nuevo estado del pedido.
 */
async function actualizarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const pedidoRef = doc(pedidosCollection, pedidoId);
        await updateDoc(pedidoRef, { estado: nuevoEstado });
        mostrarAlerta(`Estado del pedido ${pedidoId} actualizado a "${nuevoEstado}".`, "success");
    } catch (error) {
        console.error("Error al actualizar estado del pedido:", error);
        mostrarAlerta('Error al actualizar el estado del pedido.', "danger");
    }
}

// --- Event Listeners Globales y Carga Inicial ---

document.addEventListener('DOMContentLoaded', () => {
    // Para todas las páginas: actualizar el contador del carrito
    actualizarContadorCarrito();

    // Lógica para mostrar/ocultar carrito emergente
    const carritoIcono = document.getElementById('icono-carrito');
    const carritoEmergente = document.getElementById('carrito-emergente');

    if (carritoIcono && carritoEmergente) {
        carritoIcono.addEventListener('click', (event) => {
            event.stopPropagation();
            carritoEmergente.classList.toggle('oculto');
            if (!carritoEmergente.classList.contains('oculto')) {
                mostrarCarritoEmergente();
            }
        });

        document.addEventListener('click', (event) => {
            if (!carritoEmergente.contains(event.target) && !carritoIcono.contains(event.target)) {
                carritoEmergente.classList.add('oculto');
            }
        });
    }

    const currentPath = window.location.pathname;

    if (currentPath.includes('admin_panel.html')) {
        protectAdminRoute();
        cargarProductosEnAdmin();
        const formAgregar = document.getElementById('form-agregar-producto');
        if (formAgregar) {
            formAgregar.addEventListener('submit', manejarFormularioAgregar);
        }
        const formEditar = document.getElementById('form-editar-producto');
        if (formEditar) {
            formEditar.addEventListener('submit', manejarFormularioEditar);
        }
        const btnCancelarEdicion = document.getElementById('cancelar-edicion');
        if (btnCancelarEdicion) {
            btnCancelarEdicion.addEventListener('click', cancelarEdicion);
        }
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    }
    else if (currentPath.includes('admin_login.html')) {
        protectAdminRoute();
        const loginForm = document.getElementById('admin-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleAdminLogin);
        }
    }
    else if (currentPath.includes('index.html') || currentPath.includes('pages/productos.html')) {
        mostrarProductosEnTienda();
    }
    else if (currentPath.includes('pages/checkout.html')) {
        cargarResumenPedidoCheckout();
        const checkoutForm = document.getElementById('form-checkout');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', handleCheckoutFormSubmit);
        }
    }
    else if (currentPath.includes('admin_pedidos.html')) {
        protectAdminRoute();
        cargarPedidosEnAdmin();
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    }
});