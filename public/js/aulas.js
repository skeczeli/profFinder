document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const nombreAulaInput = document.getElementById('aula-nombre');
    const esp32Input = document.getElementById('aula-esp32');
    const guardarAulaBtn = document.getElementById('guardar-aula');
  
    // Evento para guardar aula
    if (guardarAulaBtn){
      guardarAulaBtn.addEventListener("click", async function (){
        // Validación básica
        if (!nombreAulaInput.value.trim()) {
          alert("Por favor ingrese el nombre del aula");
          return;
        }
        // Preparar datos para enviar
        const aulaData = {
          nombre: nombreAulaInput.value.trim(),
          esp32_id: esp32Input.value.trim(),
        };

        try {
          const response = await fetch("/admin/aula/crear", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(aulaData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Error al guardar aula");
          }

          alert("Aula guardada correctamente");

          // Limpiar formulario
          nombreAulaInput.value = "";
          esp32Input.value = "";

          // Recargar la página para mostrar el nuevo profesor
          window.location.reload();
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
        });
        }
  
// Manejar botones de eliminar en la tabla
const botonesEliminarTabla = document.querySelectorAll('#tabla-aulas .btn-eliminar');
botonesEliminarTabla.forEach(btn => {
  btn.addEventListener('click', async function(e) {
    e.preventDefault(); // Prevenir comportamiento por defecto
    
    const esp32_id = this.getAttribute('data-esp32-id'); 
    
    if (!esp32_id) {
      alert("Error: No se pudo obtener el id del aula");
      return;
    }
    
    // Agregar la confirmación antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar esta aula?")) {
      return;
    }
    
    try {
      const response = await fetch(`/admin/aula/eliminar/${esp32_id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar el aula");
      }

      alert("Aula eliminada correctamente");
      
      // Recargar la página
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
});
});