console.log("האפליקציה נטענה בהצלחה");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function () {
        console.log("Service Worker נרשם בהצלחה");
      })
      .catch(function (error) {
        console.log("שגיאה ברישום Service Worker:", error);
      });
  });
}
