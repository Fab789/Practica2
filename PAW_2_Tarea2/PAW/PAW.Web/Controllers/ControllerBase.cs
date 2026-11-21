using Microsoft.AspNetCore.Mvc;

namespace PAW.Web.Controllers;

// El tipo de cambio ya no se carga desde el servidor:
// lo consulta y cachea site.js (ver ExchangeRate.cshtml).
public class ControllerBase : Controller
{
}
