// ===== টেস্ট ভার্সন – ক্যাসকেডিং ড্রপডাউন =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🟢 Location Search module loaded');

    const divisionSelect = document.getElementById('divisionSelect');
    const districtSelect = document.getElementById('districtSelect');
    const thanaSelect = document.getElementById('thanaSelect');

    if (!divisionSelect || !districtSelect || !thanaSelect) {
        console.error('❌ Dropdown elements not found!');
        return;
    }

    // টোকেন নেওয়া
    function getAuthHeaders() {
        const token = localStorage.getItem('emailExtractorToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Division লোড
    async function loadDivisions() {
        try {
            const headers = getAuthHeaders();
            const res = await fetch('/api/finder-api/location-secret?action=getDivisions', { headers });
            const data = await res.json();
            console.log('📦 Divisions response:', data);

            if (data.success && data.divisions) {
                divisionSelect.innerHTML = '<option value="">— Select Division —</option>';
                data.divisions.forEach(div => {
                    const opt = document.createElement('option');
                    opt.value = div.id;
                    opt.textContent = div.name;
                    divisionSelect.appendChild(opt);
                });
                divisionSelect.disabled = false;
            } else {
                divisionSelect.innerHTML = '<option value="">Failed to load</option>';
                divisionSelect.disabled = true;
            }
        } catch (e) {
            console.error('Division load error:', e);
            divisionSelect.innerHTML = '<option value="">Error loading</option>';
            divisionSelect.disabled = true;
        }
    }

    // Division change → District
    divisionSelect.addEventListener('change', async function(e) {
        const divId = e.target.value;
        console.log('🔹 Division selected:', divId);

        // Thana reset
        thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
        thanaSelect.disabled = true;

        if (!divId) {
            districtSelect.innerHTML = '<option value="">— Select District —</option>';
            districtSelect.disabled = true;
            return;
        }

        districtSelect.innerHTML = '<option value="">Loading...</option>';
        districtSelect.disabled = true;

        try {
            const headers = getAuthHeaders();
            const res = await fetch(`/api/finder-api/location-secret?action=getDistricts&division=${divId}`, { headers });
            const data = await res.json();
            console.log('📦 Districts response:', data);

            if (data.success && data.districts && data.districts.length > 0) {
                districtSelect.innerHTML = '<option value="">— Select District —</option>';
                data.districts.forEach(dist => {
                    const opt = document.createElement('option');
                    opt.value = dist.id;
                    opt.textContent = dist.name;
                    districtSelect.appendChild(opt);
                });
                districtSelect.disabled = false;
            } else {
                districtSelect.innerHTML = '<option value="">No districts found</option>';
                districtSelect.disabled = true;
            }
        } catch (e) {
            console.error('District load error:', e);
            districtSelect.innerHTML = '<option value="">Error loading</option>';
            districtSelect.disabled = true;
        }
    });

    // District change → Thana
    districtSelect.addEventListener('change', async function(e) {
        const distId = e.target.value;
        console.log('🔸 District selected:', distId);

        if (!distId) {
            thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
            thanaSelect.disabled = true;
            return;
        }

        thanaSelect.innerHTML = '<option value="">Loading...</option>';
        thanaSelect.disabled = true;

        try {
            const headers = getAuthHeaders();
            const res = await fetch(`/api/finder-api/location-secret?action=getThanas&district=${distId}`, { headers });
            const data = await res.json();
            console.log('📦 Thanas response:', data);

            if (data.success && data.thanas && data.thanas.length > 0) {
                thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                data.thanas.forEach(thana => {
                    const opt = document.createElement('option');
                    opt.value = thana.id;
                    opt.textContent = thana.name;
                    thanaSelect.appendChild(opt);
                });
                thanaSelect.disabled = false;
            } else {
                thanaSelect.innerHTML = '<option value="">No thanas found</option>';
                thanaSelect.disabled = true;
            }
        } catch (e) {
            console.error('Thana load error:', e);
            thanaSelect.innerHTML = '<option value="">Error loading</option>';
            thanaSelect.disabled = true;
        }
    });

    // শুরু করুন
    loadDivisions();
});
