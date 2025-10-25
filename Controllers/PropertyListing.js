const Error = require("../Middlewares/ErrorMiddleware");
const ListProperty = async (req, res) => {
  try {

    const {first_name,last_name,email,tele_phone,listing_id,property_adress,preffered_date,preffered_time,comments}=req.body
    console.log(comments,preffered_time,preffered_date,property_adress,listing_id,tele_phone,email,last_name,first_name)
    return res.status(200).json({
      message: "Property listed successfully",
    });
  } catch (err) {
    Error(err);
  }
};
module.exports = ListProperty;
