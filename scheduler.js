function ScheduleGenerator() {
    const [weeklySchedule, setWeeklySchedule] = React.useState(null);
    const [deskSchedule, setDeskSchedule] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState('');
    const [error, setError] = React.useState('');

    const timeSlots = [
        { start: '9:00', end: '11:00' },
        { start: '11:00', end: '13:00' },
        { start: '13:00', end: '15:00' },
        { start: '15:00', end: '17:00' },
        { start: '17:00', end: '18:00' }
    ];

    const desks = ['Reference Desk', 'Circulation Desk', 'Information Desk'];

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                console.log('Loaded schedule data:', jsonData);
                setWeeklySchedule(jsonData);
                setError('');
            } catch (err) {
                setError('Error processing Excel file: ' + err.message);
                console.error('Excel processing error:', err);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const timeToHours = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + minutes / 60;
    };

    const getStaffPriority = (staff, desk, schedule, timeSlot, currentSlotIndex) => {
        const preferredDesks = staff.PreferredDesk.split(',').map(d => d.trim());
        const priorityIndex = preferredDesks.indexOf(desk);
        
        // Calculate total and consecutive hours
        let totalHours = 0;
        let consecutiveHours = 0;
        
        // Check previous assignments
        for (let i = 0; i <= currentSlotIndex; i++) {
            const slot = timeSlots[i];
            const slotKey = `${slot.start}-${slot.end}`;
            if (schedule[slotKey]) {
                Object.entries(schedule[slotKey]).forEach(([deskName, staffInfo]) => {
                    if (staffInfo.name === staff.Name) {
                        const [start, end] = slotKey.split('-');
                        totalHours += timeToHours(end) - timeToHours(start);
                        
                        if (deskName === desk) {
                            consecutiveHours += timeToHours(end) - timeToHours(start);
                        } else {
                            consecutiveHours = 0;
                        }
                    }
                });
            }
        }

        // Calculate penalties
        const consecutivePenalty = consecutiveHours >= 2 ? 1000 : consecutiveHours * 100;
        const totalHoursPenalty = totalHours >= 4 ? 2000 : totalHours * 200;
        const basePriority = priorityIndex >= 0 ? priorityIndex * 50 : 500;

        return basePriority + consecutivePenalty + totalHoursPenalty;
    };

    const generateDeskSchedule = () => {
        try {
            if (!weeklySchedule || !selectedDate) {
                setError('Please upload a schedule and select a date');
                return;
            }

            const [year, month, day] = selectedDate.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
            console.log('Processing schedule for:', dayOfWeek);

            const startColumn = `${dayOfWeek}Start`;
            const endColumn = `${dayOfWeek}End`;

            const workingStaff = weeklySchedule.filter(staff =>
                staff[startColumn] &&
                staff[startColumn] !== 'OFF' &&
                staff[endColumn] &&
                staff[endColumn] !== 'OFF'
            );

            console.log('Working staff:', workingStaff);

            const schedule = {};
            
            timeSlots.forEach((slot, slotIndex) => {
                schedule[`${slot.start}-${slot.end}`] = {};
                const assignedStaff = new Set();
                
                // First pass: Assign staff to their primary preferred desk
                desks.forEach(desk => {
                    const availableStaff = workingStaff
                        .filter(staff => 
                            !assignedStaff.has(staff.Name) &&
                            staff.PreferredDesk.split(',')[0].trim() === desk
                        )
                        .sort((a, b) => 
                            getStaffPriority(a, desk, schedule, `${slot.start}-${slot.end}`, slotIndex) -
                            getStaffPriority(b, desk, schedule, `${slot.start}-${slot.end}`, slotIndex)
                        );
                    
                    if (availableStaff.length > 0) {
                        schedule[`${slot.start}-${slot.end}`][desk] = {
                            name: availableStaff[0].Name,
                            isPrimaryPreference: true
                        };
                        assignedStaff.add(availableStaff[0].Name);
                    }
                });

                // Second pass: Fill remaining desks with staff who list it as any preference
                desks.forEach(desk => {
                    if (!schedule[`${slot.start}-${slot.end}`][desk]) {
                        const availableStaff = workingStaff
                            .filter(staff =>
                                !assignedStaff.has(staff.Name) &&
                                staff.PreferredDesk.includes(desk)
                            )
                            .sort((a, b) => 
                                getStaffPriority(a, desk, schedule, `${slot.start}-${slot.end}`, slotIndex) -
                                getStaffPriority(b, desk, schedule, `${slot.start}-${slot.end}`, slotIndex)
                            );
                        
                        if (availableStaff.length > 0) {
                            schedule[`${slot.start}-${slot.end}`][desk] = {
                                name: availableStaff[0].Name,
                                isPrimaryPreference: false
                            };
                            assignedStaff.add(availableStaff[0].Name);
                        }
                    }
                });

                // Final pass: Fill any remaining spots with any available staff
                desks.forEach(desk => {
                    if (!schedule[`${slot.start}-${slot.end}`][desk]) {
                        const availableStaff = workingStaff
                            .filter(staff => !assignedStaff.has(staff.Name))
                            .sort((a, b) => 
                                getStaffPriority(a, desk, schedule, `${slot.start}-${slot.end}`, slotIndex) -
                                getStaffPriority(b, desk, schedule, `${slot.start}-${slot.end}`, slotIndex)
                            );
                        
                        if (availableStaff.length > 0) {
                            schedule[`${slot.start}-${slot.end}`][desk] = {
                                name: availableStaff[0].Name,
                                isPrimaryPreference: false
                            };
                            assignedStaff.add(availableStaff[0].Name);
                        } else {
                            schedule[`${slot.start}-${slot.end}`][desk] = {
                                name: 'No staff available',
                                isPrimaryPreference: false
                            };
                        }
                    }
                });
            });

            // Calculate and add hours worked info
            Object.keys(schedule).forEach(timeSlot => {
                Object.keys(schedule[timeSlot]).forEach(desk => {
                    const staffInfo = schedule[timeSlot][desk];
                    if (staffInfo.name !== 'No staff available') {
                        let totalHours = 0;
                        Object.entries(schedule).forEach(([slot, desks]) => {
                            Object.values(desks).forEach(info => {
                                if (info.name === staffInfo.name) {
                                    const [start, end] = slot.split('-');
