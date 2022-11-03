export const getDateForFilename = (d: Date) => {
    return d.toISOString().replace(/:|\+|\./g, '-');
};
