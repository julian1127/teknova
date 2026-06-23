document.addEventListener("DOMContentLoaded", () => {
    console.log("Julian David cargado correctamente");

    const cards = document.querySelectorAll(".servicio-card");
    const modal = document.getElementById("galeriaModal");
    const galeria = document.getElementById("galeriaContenido");
    const cerrar = document.querySelector(".cerrar");
    const body = document.body;

    if (!modal || !galeria || !cerrar) {
        console.error("No se encontró la estructura del modal.");
        return;
    }

    const elementosAnimados = document.querySelectorAll(".animar");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, {
        threshold: 0.15
    });

    elementosAnimados.forEach(elemento => observer.observe(elemento));

    let fotosJson = {};

    fetch("fotos.json")
        .then(response => {
            if (!response.ok) {
                throw new Error("No se pudo cargar fotos.json");
            }
            return response.json();
        })
        .then(data => {
            fotosJson = data;
            console.log("Fotos cargadas correctamente");
        })
        .catch(error => {
            console.error("Error cargando fotos.json:", error);
        });

    cards.forEach(card => {
        card.addEventListener("click", () => {
            const servicio = card.dataset.servicio;
            galeria.innerHTML = "";
            modal.style.display = "flex";
            modal.setAttribute("aria-hidden", "false");
            body.classList.add("modal-abierto");

            const fotos = fotosJson[servicio] || [];

            if (fotos.length === 0) {
                galeria.innerHTML = `
                    <div class="galeria-mensaje">
                        No hay imágenes cargadas para este servicio.
                    </div>
                `;
                return;
            }

            fotos.forEach(ruta => {
                const img = document.createElement("img");
                img.src = ruta;
                img.alt = `Trabajos de ${servicio}`;
                img.loading = "lazy";
                img.classList.add("galeria-img");
                img.addEventListener("click", () => {
                    img.classList.toggle("zoom");
                });
                galeria.appendChild(img);
            });
        });
    });

    cerrar.addEventListener("click", cerrarModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            cerrarModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            cerrarModal();
        }
    });

    function cerrarModal() {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        galeria.innerHTML = "";
        body.classList.remove("modal-abierto");
    }
});