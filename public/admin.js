function showSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.add('hidden');
  });
  document.getElementById(sectionId).classList.remove('hidden');
}

function logout() {
  alert("Logged out successfully!");
  window.location.href = "../login.html"; // back to login
}

function addDoctor() {
  let name = prompt("Enter Doctor Name:");
  if(name) {
    let doctorList = document.getElementById("doctorList");
    let doctor = document.createElement("p");
    doctor.innerText = "Dr. " + name;
    doctorList.appendChild(doctor);
  }
}
