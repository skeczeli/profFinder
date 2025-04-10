// Script para manejar el formulario de profesores
document.addEventListener("DOMContentLoaded", function () {
  // Seleccionar botones y campos del formulario
  const guardarProfesorBtn = document.getElementById("guardar-profesor");
  const borrarProfesorBtn = document.getElementById("borrar-profesor");
  const nombreInput = document.getElementById("prof-nombre");
  const emailInput = document.getElementById("prof-email");
  const tarjetaInput = document.getElementById("prof-tarjeta");

  // Función para guardar profesor
  guardarProfesorBtn.addEventListener("click", async function () {
    // Validación básica
    if (!nombreInput.value.trim()) {
      alert("Por favor ingrese el nombre del profesor");
      return;
    }

    if (!tarjetaInput.value.trim()) {
      alert("Por favor ingrese el ID de tarjeta");
      return;
    }

    // Preparar datos para enviar
    const profesorData = {
      nombre: nombreInput.value.trim(),
      email: emailInput.value.trim() || null, // Permitir email vacío
      tarjeta_id: tarjetaInput.value.trim(),
    };

    try {
      const response = await fetch("/admin/profesores/crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profesorData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al guardar profesor");
      }

      alert("Profesor guardado correctamente");

      // Limpiar formulario
      nombreInput.value = "";
      emailInput.value = "";
      tarjetaInput.value = "";

      // Recargar la página para mostrar el nuevo profesor
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });

  // Función para eliminar profesor
  borrarProfesorBtn.addEventListener("click", async function () {
    const tarjetaId = tarjetaInput.value.trim();

    if (!tarjetaId) {
      alert("Por favor ingrese el ID de tarjeta del profesor a eliminar");
      return;
    }

    if (!confirm("¿Está seguro que desea eliminar este profesor?")) {
      return;
    }

    try {
      const response = await fetch(`/admin/profesores/eliminar/${tarjetaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar profesor");
      }

      alert("Profesor eliminado correctamente");

      // Limpiar formulario
      nombreInput.value = "";
      emailInput.value = "";
      tarjetaInput.value = "";

      // Recargar la página
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });

  // Permitir seleccionar profesor de la tabla para editar/eliminar
  const tbody = document.getElementById("tbody-profesores");
  if (tbody) {
    tbody.addEventListener("click", function (e) {
      const row = e.target.closest("tr");
      if (!row) return;

      const cells = row.querySelectorAll("td");
      if (cells.length >= 3) {
        nombreInput.value = cells[0].textContent;
        emailInput.value =
          cells[1].textContent !== "-" ? cells[1].textContent : "";
        tarjetaInput.value = cells[2].textContent;
      }
    });
  }
});
