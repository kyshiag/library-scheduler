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
                setWeeklySchedule(jsonData);
                setError('');
            } catch (err) {
                setError('Error processing Excel file: ' + err.message);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const calculateHoursWorked = (staffName, currentSchedule) => {
        let hours = 0;
        Object.entries(currentSchedule).forEach(([timeSlot, desks]) => {
            Object.values(desks).forEach(staffInfo => {
                if (staffInfo.name === staffName) {
                    const [start, end] = timeSlot.split('-');
                    const startHour = parseInt(start.split(':')[0]);
                    const endHour = parseInt(end.split(':')[0]);
                    hours += endHour - startHour;
                }
            });
        });
        return hours;
    };

    const hasWorkedConsecutiveHours = (staffName, desk, currentSchedule, currentSlot) => {
        const currentIndex = timeSlots.findIndex(slot => 
            `${slot.start}-${slot.end}` === currentSlot
        );
        if (currentIndex <= 0) return false;

        const previousSlot = `${timeSlots[currentIndex - 1].start}-${timeSlots[currentIndex - 1].end}`;
        return currentSchedule[previousSlot]?.[desk]?.name === staffName;
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

            const startColumn = `${dayOfWeek}Start`;
            const endColumn = `${dayOfWeek}End`;

            const workingStaff = weeklySchedule.filter(staff =>
                staff[startColumn] &&
                staff[startColumn] !== 'OFF' &&
                staff[endColumn] &&
                staff[endColumn] !== 'OFF'
            );

            const schedule = {};
            
            timeSlots.forEach(slot => {
                const timeSlot = `${slot.start}-${slot.end}`;
                schedule[timeSlot] = {};
                const assignedStaff = new Set();
                
                desks.forEach(desk => {
                    const availableStaff = workingStaff.filter(staff => {
                        if (assignedStaff.has(staff.Name)) return false;
                        if (calculateHoursWorked(staff.Name, schedule) >= 4) return false;
                        if (hasWorkedConsecutiveHours(staff.Name, desk, schedule, timeSlot)) return false;
                        return true;
                    });

                    // Try to assign someone with this desk as primary preference
                    let assigned = false;
                    const primaryStaff = availableStaff.find(staff => 
                        staff.PreferredDesk.split(',')[0].trim() === desk
                    );

                    if (primaryStaff) {
                        schedule[timeSlot][desk] = {
                            name: primaryStaff.Name,
                            isPrimaryPreference: true,
                            hoursWorked: calculateHoursWorked(primaryStaff.Name, schedule)
                        };
                        assignedStaff.add(primaryStaff.Name);
                        assigned = true;
                    }

                    // If no primary preference, try secondary
