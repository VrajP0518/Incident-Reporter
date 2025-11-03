// Toronto boundary coordinates
const torontoBoundary = [
  [43.855457, -79.639219], // Northwest
  [43.580795, -79.639219], // Southwest
  [43.580795, -79.115943], // Southeast
  [43.855457, -79.115943]  // Northeast
];

async function loadReports() {
  try {
      const response = await fetch('/api/reports');
      reportsDB = await response.json();
      updateReportsTables();
      showAllReports();
  } catch (error) {
      console.error("Failed to load reports:", error);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const storedReports = localStorage.getItem('reportsDB');
  if (storedReports) {
    reportsDB = JSON.parse(storedReports);
  }
  loadReports();  
  showAllReports();
  updateReportsTables();
});

let reportsDB = [
  { 
    id: 1, 
    lat: 43.65107, 
    lng: -79.347015, 
    type: "pothole", 
    description: "Large pothole near intersection", 
    status: "Pending",
    userId: "user1",
    image: null,
    notify: false,
    timestamp: new Date()
  }
];
let currentUser = "user_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem('cypress_user', currentUser);

// Initialize map with Toronto boundary
const map = L.map('map').setView([43.65107, -79.347015], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Add Toronto boundary polygon
const boundaryLayer = L.polygon(torontoBoundary, {
  color: 'blue',
  fillOpacity: 0.1,
  weight: 2
}).addTo(map);

let selectedLocation = null;
let selectedImage = null;

// Initialize image preview
document.getElementById('imageUpload').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      document.getElementById('imagePreview').innerHTML = 
        `<img src="${event.target.result}" alt="Preview">`;
      selectedImage = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Check if point is within Toronto boundaries
function isInToronto(latlng) {
  return latlng.lat >= 43.58 && latlng.lat <= 43.86 &&
         latlng.lng >= -79.64 && latlng.lng <= -79.11;
}

// Check for duplicate reports (within 200m and same type)
function checkForDuplicates(latlng, problemType) {
  return reportsDB.some(report => {
    const distance = Math.sqrt(
      Math.pow(report.lat - latlng.lat, 2) + 
      Math.pow(report.lng - latlng.lng, 2)
    ) * 111000;
    return distance < 200 && report.type === problemType;
  });
}

function updateReportsTables() {
  // User reports
  const userReports = reportsDB.filter(r => r.userId === currentUser);
  const userTable = document.getElementById('userReportsList');
  userTable.innerHTML = userReports.map(report => `
    <tr>
      <td>${report.id}</td>
      <td>${report.type.replace('_', ' ')}</td>
      <td>${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</td>
      <td class="status-${report.status.toLowerCase().replace(' ', '-')}">${report.status}</td>
      <td>${report.description}</td>
      <td>
        ${report.image
          ? `<img src="${report.image}" alt="Report Image" style="max-width:100px;">`
          : 'IMAGE NOT PROVIDED'}
      </td>
    </tr>
  `).join('');

  const activeReports = reportsDB.filter(r => r.status !== 'Resolved');
  document.getElementById('allReportsList').innerHTML = activeReports.map(report => `
    <tr>
      <td>${report.id}</td>
      <td>${report.type.replace('_', ' ')}</td>
      <td>${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</td>
      <td class="status-${report.status.toLowerCase().replace(' ', '-')}">${report.status}</td>
      <td>${report.description}</td>
      <td>
        ${report.image
          ? `<img src="${report.image}" alt="Report Image" style="max-width:100px;">`
          : 'IMAGE NOT PROVIDED'}
      </td>
    </tr>
  `).join('');
}

function showAllReports() {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer !== selectedLocation) {
      map.removeLayer(layer);
    }
  });

  reportsDB.forEach(report => {
    const marker = L.marker([report.lat, report.lng]).addTo(map);
    marker.bindPopup(`
      <b>Report #${report.id}</b><br>
      Type: ${report.type.replace('_', ' ')}<br>
      Status: <span class="status-${report.status.toLowerCase().replace(' ', '-')}">${report.status}</span><br>
      ${report.description}
      ${report.image ? `<br><img src="${report.image}" style="max-width:150px;">` : ''}
    `);
  });

  localStorage.setItem('reportsDB', JSON.stringify(reportsDB));
}

document.getElementById('reportForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const problemType = document.getElementById('problemType').value;
  const description = document.getElementById('description').value;
  const notifyMe = document.getElementById('notifyMe').checked;
  
  if (!selectedLocation) {
    alert("Please select a location on the map");
    return;
  }
  
  const location = selectedLocation.getLatLng();
  if (!isInToronto(location)) {
    document.getElementById('boundaryError').style.display = 'block';
    return;
  }
  document.getElementById('boundaryError').style.display = 'none';
  
  if (checkForDuplicates(location, problemType)) {
    document.getElementById('duplicateWarning').style.display = 'block';
    return;
  }
  document.getElementById('duplicateWarning').style.display = 'none';
  
  // Create new report
  const newReport = {
    id: reportsDB.length + 1,
    lat: location.lat,
    lng: location.lng,
    type: problemType,
    description,
    status: "Pending",
    userId: currentUser,
    image: selectedImage,
    notify: notifyMe,
    timestamp: new Date()
  };
  
  reportsDB.push(newReport);
  localStorage.setItem('reportsDB', JSON.stringify(reportsDB));
  document.getElementById('confirmation').textContent = 
    `Report #${newReport.id} submitted successfully!`;
  document.getElementById('reportForm').reset();
  document.getElementById('imagePreview').innerHTML = '';
  selectedImage = null;
  showAllReports();
  updateReportsTables();
});

// Map click handler
map.on('click', function(e) {
  if (selectedLocation) {
    map.removeLayer(selectedLocation);
  }
  
  selectedLocation = L.marker(e.latlng).addTo(map);
  
  // Check boundaries and duplicates
  document.getElementById('boundaryError').style.display = 
    isInToronto(e.latlng) ? 'none' : 'block';
  
  const problemType = document.getElementById('problemType').value;
  if (problemType) {
    document.getElementById('duplicateWarning').style.display = 
      checkForDuplicates(e.latlng, problemType) ? 'block' : 'none';
  }
});

// Problem type change handler
document.getElementById('problemType').addEventListener('change', function() {
  if (selectedLocation) {
    document.getElementById('duplicateWarning').style.display = 
      checkForDuplicates(selectedLocation.getLatLng(), this.value) ? 'block' : 'none';
  }
});

showAllReports();
updateReportsTables();