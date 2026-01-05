/* ================= CONFIGURATION ================= */

// 👇 PASTE YOUR RENDER URL HERE (No trailing slash)
const API_BASE_URL = "https://nagrik-raskshak.onrender.com";

// Use this one if you are testing locally on your laptop:
// const API_BASE_URL = "http://localhost:3000"; 


/* ================= USER STATE ================= */
const user = JSON.parse(localStorage.getItem("user"));
let selectedDepartment = "All";

if (!user) {
  alert("Login required");
  window.location.href = "auth.html?mode=login";
}

// ================= MAP INIT =================
const map = L.map("map").setView([26.7606, 83.3732], 13);

function addComplaintMarker(c) {
  if (!c.location || !c.location._latitude || !c.location._longitude) return;

  const lat = c.location._latitude;
  const lng = c.location._longitude;

  const priority = c.priority || "Low";

  let color = "#22c55e"; // 🟢 Low
  if (priority === "High") color = "#ef4444"; // 🔴
  else if (priority === "Medium") color = "#eab308"; // 🟡

  const marker = L.circleMarker([lat, lng], {
    radius: 8,
    fillColor: color,
    color: "#000",
    weight: 1,
    fillOpacity: 0.9,
  }).addTo(map);

  marker.bindPopup(`
    <b>${c.description}</b><br>
    Dept: ${c.department || "Unassigned"}<br>
    Priority: ${priority}<br>
    📍 ${c.address || "Unknown"}
  `);

  markers.push(marker);
}

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

// ================= COMPLAINTS =================
let markers = [];
let allComplaints = [];

async function loadComplaints() {
  try {
    // 🔥 MAP CLEAR
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/complaints`);
    const complaints = await res.json();
    allComplaints = complaints;

    const recentContainer = document.getElementById("recentComplaints");
    const highBox = document.getElementById("highRisk");
    const mediumBox = document.getElementById("mediumRisk");
    const lowBox = document.getElementById("lowRisk");

    // CLEAR ONCE
    recentContainer.innerHTML = "";
    highBox.innerHTML = "";
    mediumBox.innerHTML = "";
    lowBox.innerHTML = "";

    complaints.forEach((c, index) => {
      // ⛔ Department filter
      if (selectedDepartment !== "All" && c.department !== selectedDepartment) {
        return;
      }
      addComplaintMarker(c);

      const priority = c.priority || "Low";
      const status = c.status || "new";
      const isOverdue = c.isOverdue || false;

      // UPDATED: Image Source uses API_BASE_URL
      const imageHTML = c.imagePath
        ? `
        <div class="img-wrap">
          <img src="${API_BASE_URL}/${c.imagePath}"
               onclick="openImage(this.src)">
        </div>
      `
        : "";

      if (index < 3) {
        const card = document.createElement("div");
        card.className = `card ${priority.toLowerCase()} ${isOverdue ? "overdue" : ""}`;

        card.innerHTML = `
          <div class="priority ${priority.toLowerCase()}">
            ${priority} Priority
            ${isOverdue ? " ⚠️ OVERDUE" : ""}
          </div>

          ${imageHTML}

          <b>${c.description.substring(0, 60)}${c.description.length > 60 ? "..." : ""}</b><br>
          <small>📍 ${c.address || "Unknown"}</small><br>
          <small>📊 Status: <span class="status-badge ${status}">${status}</span></small><br>
          <small>⏰ ${c.timePassed} ago</small><br>
          
          <div class="action-buttons" data-id="${c.id}">
            ${status === "classified"
                ? `<button class="action-btn mark-action" onclick="updateStatus('${c.id}', 'under_action')">
                    ⚡ Take Action
                   </button>`
                : ""}
            
            ${status === "under_action"
                ? `<button class="action-btn mark-resolved" onclick="updateStatus('${c.id}', 'resolved')">
                    ✅ Mark Resolved
                   </button>`
                : ""}
            
            ${status === "resolved"
                ? `<span class="resolved-badge">✅ Resolved</span>`
                : ""}
            
            ${status === "new"
                ? `<span class="status-badge new">Awaiting Classification</span>`
                : ""}
          </div>
        `;

        recentContainer.appendChild(card);
      }

      /* ================= LIST VIEW (RISK) ================= */
      const item = document.createElement("div");
      item.className = `risk-item ${isOverdue ? "overdue" : ""}`;

      item.innerHTML = `
        <span class="priority ${priority.toLowerCase()}">
          ${priority} Priority
          ${isOverdue ? " ⚠️ OVERDUE" : ""}
        </span>

        <p class="desc">${c.description.substring(0, 80)}${c.description.length > 80 ? "..." : ""}</p>
        <small>📍 ${c.address || "Unknown"}</small><br>
        <small>📊 Status: <span class="status-badge ${status}">${status}</span></small><br>
        <small>⏰ ${c.timePassed} ago</small>
        
        <div class="action-buttons" data-id="${c.id}">
          ${status === "classified"
              ? `<button class="action-btn mark-action" onclick="updateStatus('${c.id}', 'under_action')">
                  ⚡ Take Action
                 </button>`
              : ""}
          
          ${status === "under_action"
              ? `<button class="action-btn mark-resolved" onclick="updateStatus('${c.id}', 'resolved')">
                  ✅ Mark Resolved
                 </button>`
              : ""}
          
          ${status === "resolved"
              ? `<span class="resolved-badge">✅ Resolved</span>`
              : ""}
          
          ${status === "new"
              ? `<span class="status-badge new">Awaiting Classification</span>`
              : ""}
        </div>
      `;

      if (priority === "High") {
        highBox.appendChild(item);
      } else if (priority === "Medium") {
        mediumBox.appendChild(item);
      } else {
        lowBox.appendChild(item);
      }
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [40, 40] });
    }

    // Apply overdue styling to body if any complaint is overdue
    const hasOverdue = complaints.some((c) => c.isOverdue);
    document.body.classList.toggle("overdue-alert", hasOverdue);
  } catch (err) {
    console.error("Failed to load complaints:", err);
  }
}

// ================= UPDATE STATUS =================
async function updateStatus(complaintId, newStatus) {
  const adminName = user?.name || "Admin";

  if (!confirm(`Change status to "${newStatus}"?`)) return;

  try {
    // UPDATED: Uses API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/update-complaint-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complaintId,
        status: newStatus,
        adminName,
      }),
    });

    const data = await res.json();

    if (data.success) {
      // Show success message
      showNotification(`Status updated to ${newStatus}`, "success");

      // Refresh after 1 second
      setTimeout(() => {
        loadComplaints();
      }, 1000);
    } else {
      showNotification("Failed: " + (data.message || "Unknown error"), "error");
    }
  } catch (err) {
    console.error("Update failed:", err);
    showNotification("Network error. Please try again.", "error");
  }
}

// ================= NOTIFICATION FUNCTION =================
function showNotification(message, type = "info") {
  // Remove existing notification
  const existing = document.querySelector(".status-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `status-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      ${message}
      <button onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// ================= LIVE LOCATION =================
let liveLocationMarker = null;
let liveAccuracyCircle = null;
let liveLocationCentered = false;

function showLiveLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;

    if (liveLocationMarker) map.removeLayer(liveLocationMarker);
    if (liveAccuracyCircle) map.removeLayer(liveAccuracyCircle);

    liveLocationMarker = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup("📍 Your Live Location");

    liveAccuracyCircle = L.circle([latitude, longitude], {
      radius: accuracy,
      color: "#3b82f6",
      fillOpacity: 0.15,
    }).addTo(map);

    if (!liveLocationCentered) {
      map.setView([latitude, longitude], 16);
      liveLocationCentered = true;
    }
  });
}

// ================= IMAGE MODAL =================
function openImage(src) {
  const modal = document.getElementById("imageModal");
  document.getElementById("modalImg").src = src;
  modal.classList.remove("hidden");
}

function closeImage() {
  document.getElementById("imageModal").classList.add("hidden");
}

// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  const knob = document.getElementById("knob");
  const switchBox = document.getElementById("switch");
  const mapView = document.getElementById("mapView");
  const listView = document.getElementById("listView");
  const deptSelect = document.getElementById("departmentSelect");

  // Set user name
  if (user?.name) {
    document.getElementById("userName").innerText = "Admin: " + user.name;
  }

  deptSelect.addEventListener("change", () => {
    selectedDepartment = deptSelect.value;
    loadComplaints();
  });

  let isMap = true;

  mapView.classList.remove("hidden");
  listView.classList.add("hidden");
  knob.style.left = "2px";

  switchBox.addEventListener("click", () => {
    if (isMap) {
      mapView.classList.add("hidden");
      listView.classList.remove("hidden");
      knob.style.left = "56px";
    } else {
      listView.classList.add("hidden");
      mapView.classList.remove("hidden");
      knob.style.left = "2px";

      setTimeout(() => {
        map.invalidateSize(true);
        showLiveLocation();
      }, 300);
    }
    isMap = !isMap;
  });

  // Load complaints every 30 seconds for real-time updates
  loadComplaints();
  setInterval(loadComplaints, 30000);

  setTimeout(() => {
    map.invalidateSize(true);
    showLiveLocation();
  }, 400);

  const modal = document.getElementById("imageModal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeImage();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeImage();
  });
});
