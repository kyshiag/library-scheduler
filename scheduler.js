// Replace the existing parseTime function and add this new function above generateDeskSchedule:
const getStaffPriority = (staff, desk) => {
    const preferredDesks = staff.PreferredDesk.split(',').map(d => d.trim());
    const priorityIndex = preferredDesks.indexOf(desk);
    return priorityIndex >= 0 ? priorityIndex : 999; // Non-preferred desks get low priority
};

// Update the staff filtering and assignment logic in generateDeskSchedule:
const schedule = {};
timeSlots.forEach(slot => {
    schedule[`${slot.start}-${slot.end}`] = {};
    const assignedStaff = new Set();
    
    // First pass: Assign staff to their primary preferred desk
    desks.forEach(desk => {
        const availableStaff = workingStaff.filter(staff => 
            !assignedStaff.has(staff.Name) &&
            staff.PreferredDesk.split(',')[0].trim() === desk // Check primary preference
        );
        
        if (availableStaff.length > 0) {
            schedule[`${slot.start}-${slot.end}`][desk] = {
                name: availableStaff[0].Name,
                isPrimaryPreference: true
            };
            assignedStaff.add(availableStaff[0].Name);
        }
    });

    // Second pass: Fill remaining desks with staff who list it as secondary preference
    desks.forEach(desk => {
        if (!schedule[`${slot.start}-${slot.end}`][desk]) {
            const availableStaff = workingStaff.filter(staff => 
                !assignedStaff.has(staff.Name) &&
                staff.PreferredDesk.includes(desk)
            ).sort((a, b) => getStaffPriority(a, desk) - getStaffPriority(b, desk));
            
            if (availableStaff.length > 0) {
                schedule[`${slot.start}-${slot.end}`][desk] = {
                    name: availableStaff[0].Name,
                    isPrimaryPreference: false
                };
                assignedStaff.add(availableStaff[0].Name);
            }
        }
    });

    // Final pass: Fill any remaining spots
    desks.forEach(desk => {
        if (!schedule[`${slot.start}-${slot.end}`][desk]) {
            const availableStaff = workingStaff.filter(staff => 
                !assignedStaff.has(staff.Name)
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

// Update the rendering section to show primary preference indicator:
{Object.entries(deskSchedule).map(([timeSlot, desks]) => (
    <div key={timeSlot} className="mb-4">
        <h4 className="font-medium">{timeSlot}</h4>
        <div className="grid grid-cols-3 gap-4 mt-2">
            {Object.entries(desks).map(([desk, staffInfo]) => (
                <div 
                    key={desk} 
                    className={`border p-2 rounded ${
                        staffInfo.name === 'No staff available' ? 'bg-red-50' : 
                        staffInfo.isPrimaryPreference ? 'bg-green-50' : ''
                    }`}
                >
                    <div className="font-medium">{desk}</div>
                    <div>{staffInfo.name}</div>
                    {staffInfo.isPrimaryPreference && 
                        <div className="text-xs text-green-600 mt-1">Primary Preference</div>
                    }
                </div>
            ))}
        </div>
    </div>
))}
