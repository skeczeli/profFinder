document.addEventListener("DOMContentLoaded", function () {
  // Seleccionar botones y campos del formulario
  const guardarProfesorBtn = document.getElementById("guardar-profesor");
  const nombreInput = document.getElementById("prof-nombre");
  const emailInput = document.getElementById("prof-email");
  const tarjetaInput = document.getElementById("prof-tarjeta");

  // Función para guardar profesor
  if (guardarProfesorBtn) {
    guardarProfesorBtn.addEventListener("click", async function () {
      // Validación básica
      if (!nombreInput.value.trim()) {
        alert("Por favor ingrese el nombre del profesor");
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
  }
  
  // Manejar botones de eliminar en la tabla
  const botonesEliminarTabla = document.querySelectorAll('#tabla-profesores .btn-eliminar');
  botonesEliminarTabla.forEach(btn => {
    btn.addEventListener('click', async function(e) {
      e.preventDefault(); // Prevenir comportamiento por defecto
      
      const tarjetaId = this.getAttribute('data-tarjeta');
      
      if (!tarjetaId) {
        alert("Error: No se pudo obtener el ID de tarjeta");
        return;
      }
      
      // Agregar la confirmación antes de eliminar
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
        
        // Recargar la página
        window.location.reload();
      } catch (error) {
        alert(`Error: ${error.message}`);
      }
    });
  });
});