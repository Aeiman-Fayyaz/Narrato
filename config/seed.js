const Category = require('../models/Category');

const seedData = async () => {
  try {
    const count = await Category.countDocuments({});
    if (count === 0) {
      console.log('Seeding default categories to MongoDB...');
      await Category.create([
        {
          name: 'Technology',
          slug: 'technology',
          description: 'Articles on software engineering, gadgets, and computer science innovations.',
          image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60'
        },
        {
          name: 'Business',
          slug: 'business',
          description: 'Insights on marketing, startup culture, and global financial metrics.',
          image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60'
        },
        {
          name: 'Lifestyle',
          slug: 'lifestyle',
          description: 'Insights on travel, food, fitness, and living a balanced life.',
          image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=500&auto=format&fit=crop&q=60'
        },
        {
          name: 'Design & UX',
          slug: 'design-ux',
          description: 'Web styling trends, interfaces layout designs, and graphics typography.',
          image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=500&auto=format&fit=crop&q=60'
        }
      ]);
      console.log('Categories seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding database collections:', error);
  }
};

module.exports = seedData;
